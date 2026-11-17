import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type MicStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export interface MicErrorInfo {
  code: string;
  message: string;
  hint: string;
}

interface MediaStreamContextValue {
  micStream: MediaStream | null;
  micStatus: MicStatus;
  micError: MicErrorInfo | null;
  micLevel: number;
  audioContext: AudioContext | null;
  requestMicrophone: () => Promise<MediaStream | null>;
  unlockAudioContext: () => Promise<AudioContext | null>;
  createRecorder: () => { recorder: MediaRecorder; mimeType: string } | null;
}

const MediaStreamContext = createContext<MediaStreamContextValue | null>(null);

function mapMicError(err: unknown): MicErrorInfo {
  const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name || 'Error';

  if (
    !window.isSecureContext &&
    location.hostname !== 'localhost' &&
    location.hostname !== '127.0.0.1'
  ) {
    return {
      code: 'InsecureContext',
      message: 'Браузер блокирует микрофон на небезопасном HTTP.',
      hint: 'Откройте игру по HTTPS (на Vercel/Render это работает автоматически) или через localhost.',
    };
  }

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        code: name,
        message: 'Доступ к микрофону запрещён.',
        hint: 'Нажмите на иконку замка в адресной строке, разрешите микрофон и нажмите «Включить микрофон».',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        code: name,
        message: 'Микрофон не найден.',
        hint: 'Подключите микрофон или наушники с гарнитурой и попробуйте снова.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        code: name,
        message: 'Микрофон занят другим приложением.',
        hint: 'Закройте другие программы с микрофоном и нажмите «Включить микрофон».',
      };
    default:
      return {
        code: name,
        message: 'Не удалось включить микрофон.',
        hint: 'Проверьте разрешения браузера или продолжайте без микрофона.',
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

export const MediaStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [micError, setMicError] = useState<MicErrorInfo | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const requestingPromiseRef = useRef<Promise<MediaStream | null> | null>(null);

  const unlockAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioCtx();
        setAudioContext(ctxRef.current);
      }
      if (ctxRef.current.state === 'suspended') {
        await ctxRef.current.resume().catch(() => {});
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const attachAnalyser = useCallback(
    async (stream: MediaStream) => {
      const ctx = await unlockAudioContext();
      if (!ctx) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const timeData = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const c = (timeData[i] - 128) / 128;
          sumSq += c * c;
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        setMicLevel(Math.min(1, rms * 4.0));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [unlockAudioContext]
  );

  const requestMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    await unlockAudioContext();

    if (streamRef.current) {
      const liveTrack = streamRef.current.getAudioTracks().find((t) => t.readyState === 'live');
      if (liveTrack) {
        setMicStatus('granted');
        return streamRef.current;
      }
    }

    if (requestingPromiseRef.current) {
      return requestingPromiseRef.current;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicStatus('error');
      setMicError({
        code: 'Unsupported',
        message: 'Ваш браузер не поддерживает getUserMedia.',
        hint: 'Используйте современный Chrome, Safari, Edge или Firefox.',
      });
      return null;
    }

    setMicStatus('requesting');
    setMicError(null);

    const promise = navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then(async (stream) => {
        streamRef.current = stream;
        setMicStream(stream);
        setMicStatus('granted');
        setMicError(null);
        await attachAnalyser(stream);
        return stream;
      })
      .catch((err) => {
        const mapped = mapMicError(err);
        setMicError(mapped);
        setMicStatus(mapped.code === 'NotAllowedError' || mapped.code === 'PermissionDeniedError' ? 'denied' : 'error');
        return null;
      })
      .finally(() => {
        requestingPromiseRef.current = null;
      });

    requestingPromiseRef.current = promise;
    return promise;
  }, [attachAnalyser, unlockAudioContext]);

  const createRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return null;
    const live = stream.getAudioTracks().some((t) => t.readyState === 'live');
    if (!live) return null;

    const mimeType = pickOpusMimeType();
    const options: MediaRecorderOptions = mimeType
      ? { mimeType, audioBitsPerSecond: 36000 }
      : { audioBitsPerSecond: 36000 };
    const recorder = new MediaRecorder(stream, options);
    return { recorder, mimeType: recorder.mimeType || mimeType || 'audio/webm;codecs=opus' };
  }, []);

  // Only stop stream on full page unmount (never between rounds!)
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <MediaStreamContext.Provider
      value={{
        micStream,
        micStatus,
        micError,
        micLevel,
        audioContext,
        requestMicrophone,
        unlockAudioContext,
        createRecorder,
      }}
    >
      {children}
    </MediaStreamContext.Provider>
  );
};

export function useMediaStream(): MediaStreamContextValue {
  const ctx = useContext(MediaStreamContext);
  if (!ctx) {
    throw new Error('useMediaStream must be used within MediaStreamProvider');
  }
  return ctx;
}
