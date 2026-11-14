import { useCallback, useEffect, useRef, useState } from 'react';

export interface MicErrorInfo {
  code: string;
  message: string;
  hint: string;
}

function mapMicError(err: unknown): MicErrorInfo {
  const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name || 'Error';

  if (
    !window.isSecureContext &&
    location.hostname !== 'localhost' &&
    location.hostname !== '127.0.0.1'
  ) {
    return {
      code: 'InsecureContext',
      message: 'Браузер блокирует микрофон на HTTP-сайте.',
      hint: 'Используйте HTTPS (на Vercel/Render это работает автоматически) или localhost.',
    };
  }

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        code: name,
        message: 'Доступ к микрофону запрещён.',
        hint: 'Разрешите микрофон в настройках браузера (иконка замка в адресной строке) и нажмите «Повторить».',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        code: name,
        message: 'Микрофон не найден.',
        hint: 'Подключите гарнитуру или микрофон и попробуйте снова.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        code: name,
        message: 'Микрофон занят другим приложением.',
        hint: 'Закройте другие программы/вкладки с записью звука и повторите попытку.',
      };
    default:
      return {
        code: name,
        message: 'Не удалось запустить микрофон.',
        hint: 'Проверьте разрешения или пропустите этот раунд.',
      };
  }
}

function pickOpusMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<MicErrorInfo | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanupAudioGraph = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicActive(false);
    setMicLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupAudioGraph();
    };
  }, [cleanupAudioGraph]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setMicError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError({
        code: 'Unsupported',
        message: 'Браузер не поддерживает запись с микрофона.',
        hint: 'Откройте игру в современном Chrome, Safari, Edge или Firefox.',
      });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setMicActive(true);

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);

      const timeData = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const centered = (timeData[i] - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        setMicLevel(Math.min(1, rms * 3.8));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const mimeType = pickOpusMimeType();
      const options: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 36000 }
        : { audioBitsPerSecond: 36000 };
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || 'audio/webm;codecs=opus';
        const blob =
          chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: finalType }) : null;
        cleanupAudioGraph();
        setIsRecording(false);
        const resolver = resolveStopRef.current;
        resolveStopRef.current = null;
        resolver?.(blob);
      };

      startTimeRef.current = performance.now();
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((performance.now() - startTimeRef.current) / 1000);
      }, 45);

      recorder.start(120);
      setIsRecording(true);
      return true;
    } catch (err) {
      cleanupAudioGraph();
      setMicError(mapMicError(err));
      return false;
    }
  }, [cleanupAudioGraph]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        cleanupAudioGraph();
        setIsRecording(false);
        resolve(null);
        return;
      }
      resolveStopRef.current = resolve;
      try {
        rec.stop();
      } catch {
        cleanupAudioGraph();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [cleanupAudioGraph]);

  const resetError = useCallback(() => setMicError(null), []);

  return {
    isRecording,
    micActive,
    micLevel,
    micError,
    elapsedSec,
    startRecording,
    stopRecording,
    resetError,
  };
}
