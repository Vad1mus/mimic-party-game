import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, SkipForward, Mic } from 'lucide-react';
import { Player, RoomState, VoiceAnalysisMetrics } from '../types/game';
import { useMediaStream } from '../contexts/MediaStreamContext';
import { WaveformOverlayRecorder } from './WaveformOverlayRecorder';
import { PhaseCountdown } from './PhaseCountdown';
import { ConcertStage } from './ConcertStage';
import { resolveMediaUrl } from '../utils/serverUrl';
import {
  analyzeVoiceSimilarity,
  decodeAndNormalizeAudio,
  extractWaveformPeaks,
} from '../utils/voiceSimilarityAnalyzer';
import { soundFx } from '../utils/soundFx';

interface RecordingPhaseProps {
  room: RoomState;
  me: Player;
  onSubmitRecording: (payload: {
    buffer: ArrayBuffer;
    mimeType: string;
    duration: number;
    analysis: VoiceAnalysisMetrics;
  }) => Promise<boolean>;
  onSkipRecording: () => void;
}

export const RecordingPhase: React.FC<RecordingPhaseProps> = ({
  room,
  me,
  onSubmitRecording,
  onSkipRecording,
}) => {
  const { micStatus, micLevel, micError, createRecorder, requestMicrophone } = useMediaStream();

  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>(() => new Array(120).fill(0.15));
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [uploading, setUploading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const stoppedRef = useRef(false);

  const myRec = room.recordings[me.id];
  const hasMyRec = Boolean(myRec);
  const isSequential = room.settings.recordingMode === 'sequential';
  const isMyTurn = !isSequential || room.activeTurnPlayerId === me.id;
  const activeTurnPlayer = room.players.find((p) => p.id === room.activeTurnPlayerId);
  const meme = room.selectedMeme;
  const exactDuration = originalBuffer?.duration || meme?.duration || 4.0;

  // Refs so async audio decoding or parent callbacks NEVER cancel the 3-2-1 countdown timers!
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const exactDurationRef = useRef<number>(exactDuration);
  const createRecorderRef = useRef(createRecorder);
  const onSkipRef = useRef(onSkipRecording);

  useEffect(() => {
    originalBufferRef.current = originalBuffer;
  }, [originalBuffer]);

  useEffect(() => {
    exactDurationRef.current = exactDuration;
  }, [exactDuration]);

  useEffect(() => {
    createRecorderRef.current = createRecorder;
  }, [createRecorder]);

  useEffect(() => {
    onSkipRef.current = onSkipRecording;
  }, [onSkipRecording]);

  // Decode original meme audio for HTML5 Canvas Waveform Overlay & exact duration
  useEffect(() => {
    let cancelled = false;
    if (!meme?.url) return;
    decodeAndNormalizeAudio(resolveMediaUrl(meme.url))
      .then((buf) => {
        if (cancelled) return;
        originalBufferRef.current = buf;
        exactDurationRef.current = buf.duration || meme.duration || 4.0;
        setOriginalBuffer(buf);
        setOriginalPeaks(extractWaveformPeaks(buf, 120));
      })
      .catch(() => {
        if (!cancelled) {
          originalBufferRef.current = null;
          setOriginalBuffer(null);
          setOriginalPeaks(new Array(120).fill(0.2));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [meme?.url, meme?.duration]);

  const finishAndUpload = useCallback(
    async (blob: Blob, recordedDur: number) => {
      setUploading(true);
      const origBuf = originalBufferRef.current;
      const targetDur = exactDurationRef.current;

      let analysis: VoiceAnalysisMetrics = {
        similarity: 0,
        timingScore: 0,
        intonationScore: 0,
        energyScore: 0,
        activeDuration: 0,
        isSilent: true,
      };
      let actualDuration = Number(recordedDur.toFixed(2)) || targetDur;

      try {
        const playerBuffer = await decodeAndNormalizeAudio(blob);
        actualDuration = Number(playerBuffer.duration.toFixed(2)) || actualDuration;
        if (origBuf) {
          analysis = analyzeVoiceSimilarity(origBuf, playerBuffer);
        }
      } catch {
        analysis = {
          similarity: 45,
          timingScore: 50,
          intonationScore: 40,
          energyScore: 45,
          activeDuration: actualDuration,
          isSilent: false,
        };
      }

      try {
        const arrayBuf = await blob.arrayBuffer();
        await onSubmitRecording({
          buffer: arrayBuf,
          mimeType: blob.type || 'audio/webm;codecs=opus',
          duration: actualDuration,
          analysis,
        });
        soundFx.pop();
      } finally {
        setUploading(false);
      }
    },
    [onSubmitRecording]
  );

  const finishAndUploadRef = useRef(finishAndUpload);
  useEffect(() => {
    finishAndUploadRef.current = finishAndUpload;
  }, [finishAndUpload]);

  // Automatic 3 -> 2 -> 1 -> ГОВОРИ! -> Record strictly for exactDuration -> Auto-Stop & Upload!
  useEffect(() => {
    if (!isMyTurn || hasMyRec || micStatus !== 'granted') return;
    if (startedRef.current) return;

    startedRef.current = true;
    stoppedRef.current = false;

    const timeouts: number[] = [];

    setCountdownLabel('3');
    soundFx.beep(520, 0.08, 0.07);

    timeouts.push(
      window.setTimeout(() => {
        setCountdownLabel('2');
        soundFx.beep(620, 0.08, 0.07);
      }, 650)
    );

    timeouts.push(
      window.setTimeout(() => {
        setCountdownLabel('1');
        soundFx.beep(740, 0.08, 0.07);
      }, 1300)
    );

    timeouts.push(
      window.setTimeout(() => {
        setCountdownLabel('ГОВОРИ!');
        soundFx.startRecord();

        const created = createRecorderRef.current();
        if (!created) {
          setCountdownLabel(null);
          return;
        }

        const { recorder, mimeType } = created;
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        const recStartMs = performance.now();
        recorder.onstop = () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          setIsRecording(false);
          const dur = (performance.now() - recStartMs) / 1000;
          const blob =
            chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: mimeType }) : null;
          if (blob && blob.size >= 150) {
            void finishAndUploadRef.current(blob, dur);
          } else {
            onSkipRef.current();
          }
        };

        recorder.start(100);
        setIsRecording(true);
        setElapsedSec(0);

        timeouts.push(window.setTimeout(() => setCountdownLabel(null), 550));

        const loop = () => {
          const elapsed = (performance.now() - recStartMs) / 1000;
          setElapsedSec(elapsed);
          const targetDur = exactDurationRef.current;
          if (elapsed >= targetDur) {
            if (!stoppedRef.current && recorder.state !== 'inactive') {
              stoppedRef.current = true;
              recorder.stop();
            }
            return;
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      }, 1950)
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.onstop = null;
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      // Allow clean restart if unmounted/remounted (e.g. React StrictMode double-invoke in dev)
      startedRef.current = false;
    };
  }, [isMyTurn, hasMyRec, micStatus]);

  useEffect(() => {
    if (!isMyTurn) {
      startedRef.current = false;
    }
  }, [isMyTurn]);

  const timeLeft = Math.max(0, exactDuration - elapsedSec);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="party-card rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300">
            Раунд {room.currentRound}/{room.settings.totalRounds} • Авто-запись ({exactDuration.toFixed(1)}с)
          </div>
          <h2 className="font-display text-lg sm:text-2xl font-black text-white truncate">
            {isSequential
              ? isMyTurn
                ? 'Твоя очередь на сцене!'
                : `Выступает ${activeTurnPlayer?.nickname || '...'}`
              : 'Попадай голосом в волну!'}
          </h2>
        </div>
        <PhaseCountdown phaseEndsAt={room.phaseEndsAt} />
      </div>

      {isSequential && (
        <ConcertStage
          players={room.players}
          activePlayerId={room.activeTurnPlayerId}
          speakerVolume={isMyTurn ? micLevel : 0.25}
          meme={meme}
          myPlayerId={me.id}
        />
      )}

      {/* Main Automated Recorder Card */}
      <div className="party-card relative rounded-3xl p-4 sm:p-6 flex flex-col items-center text-center space-y-4 overflow-hidden">
        {myRec ? (
          <div className="space-y-3 py-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
              {myRec.skipped ? 'Раунд пропущен' : 'Готово! Пародия отправлена!'}
            </h3>
            <p className="text-xs sm:text-sm text-white/65">
              Ждём остальных — сейчас все выступят на сцене!
            </p>
          </div>
        ) : !isMyTurn ? (
          <p className="text-sm font-bold text-white/70 py-4">
            Сейчас записывает {activeTurnPlayer?.nickname}. Приготовься!
          </p>
        ) : micStatus !== 'granted' ? (
          <div className="w-full rounded-2xl bg-rose-500/20 border border-rose-400/50 p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 font-display font-bold text-rose-200">
              <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0" />
              <span>{micError?.message || 'Микрофон не включён'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => requestMicrophone()}
                className="party-btn-cyan text-xs sm:text-sm px-4 py-2"
              >
                <Mic className="h-4 w-4" />
                <span>Включить микрофон</span>
              </button>
              <button
                type="button"
                onClick={onSkipRecording}
                className="party-btn-ghost text-xs px-4 py-2"
              >
                <SkipForward className="h-4 w-4" />
                <span>Пропустить</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {meme && (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-amber-200 max-w-full">
                <span>{meme.emoji}</span>
                <span className="truncate">{meme.promptHint}</span>
              </div>
            )}

            {/* Big Animated 3-2-1-ГОВОРИ! Badge */}
            <AnimatePresence mode="wait">
              {countdownLabel && (
                <motion.div
                  key={countdownLabel}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`font-display font-black tracking-wide ${
                    countdownLabel === 'ГОВОРИ!'
                      ? 'text-3xl sm:text-5xl text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.8)]'
                      : 'text-5xl sm:text-6xl text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)]'
                  }`}
                >
                  {countdownLabel}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Karaoke Waveform Overlay Canvas */}
            <WaveformOverlayRecorder
              originalPeaks={originalPeaks}
              memeDuration={exactDuration}
              isRecording={isRecording}
              elapsedSec={elapsedSec}
              micLevel={micLevel}
            />

            {/* Live Recording Status */}
            <div className="flex items-center justify-center gap-3 min-h-[28px]">
              {isRecording ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/25 border border-rose-400 px-4 py-1 text-xs sm:text-sm font-extrabold text-rose-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400 animate-ping" />
                  <span>Идёт запись • {timeLeft.toFixed(1)}с</span>
                </span>
              ) : uploading ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 border border-cyan-400 px-4 py-1 text-xs font-extrabold text-cyan-200 animate-pulse">
                  Анализ голоса и отправка...
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Compact Readiness Strip */}
      <div className="party-card rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center gap-1.5 justify-center">
        {room.players.map((p) => {
          const rec = room.recordings[p.id];
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 border text-[11px] font-bold ${
                rec
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              <span>{p.nickname}</span>
              <span>{rec ? (rec.skipped ? '🙈' : '✅') : '🎙️'}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
