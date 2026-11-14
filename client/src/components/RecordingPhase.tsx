import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SkipForward,
  FastForward,
} from 'lucide-react';
import { Player, RoomState, VoiceAnalysisMetrics } from '../types/game';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
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
  onForceFinish: () => void;
}

export const RecordingPhase: React.FC<RecordingPhaseProps> = ({
  room,
  me,
  onSubmitRecording,
  onSkipRecording,
  onForceFinish,
}) => {
  const {
    isRecording,
    micActive,
    micLevel,
    micError,
    elapsedSec,
    startRecording,
    stopRecording,
    resetError,
  } = useAudioRecorder();

  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>(() => new Array(120).fill(0.15));
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const stoppingRef = useRef(false);

  const myRec = room.recordings[me.id];
  const isSequential = room.settings.recordingMode === 'sequential';
  const isMyTurn = !isSequential || room.activeTurnPlayerId === me.id;
  const activeTurnPlayer = room.players.find((p) => p.id === room.activeTurnPlayerId);
  const maxSec = room.settings.recordingTimeSec;
  const meme = room.selectedMeme;

  // Decode original meme audio for HTML5 Canvas Waveform Overlay + WebAudio similarity scoring
  useEffect(() => {
    let cancelled = false;
    if (!meme?.url) return;
    decodeAndNormalizeAudio(resolveMediaUrl(meme.url))
      .then((buf) => {
        if (cancelled) return;
        setOriginalBuffer(buf);
        setOriginalPeaks(extractWaveformPeaks(buf, 120));
      })
      .catch(() => {
        if (!cancelled) {
          setOriginalBuffer(null);
          setOriginalPeaks(new Array(120).fill(0.2));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [meme?.url]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const handleStopAndSend = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setUploadErr(null);

    const blob = await stopRecording();
    if (!blob || blob.size < 200) {
      stoppingRef.current = false;
      setUploadErr('Запись получилась пустой. Попробуйте ещё раз!');
      return;
    }

    const preview = URL.createObjectURL(blob);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });

    setUploading(true);
    try {
      // Real deterministic Web Audio API comparison!
      let analysis: VoiceAnalysisMetrics = {
        similarity: 0,
        timingScore: 0,
        intonationScore: 0,
        energyScore: 0,
        activeDuration: 0,
        isSilent: true,
      };
      let actualDuration = Math.max(0.5, elapsedSec);

      try {
        const playerBuffer = await decodeAndNormalizeAudio(blob);
        actualDuration = Number(playerBuffer.duration.toFixed(2)) || actualDuration;
        if (originalBuffer) {
          analysis = analyzeVoiceSimilarity(originalBuffer, playerBuffer);
        }
      } catch {
        // Fallback if a browser failed to decode its own blob
        analysis = {
          similarity: 45,
          timingScore: 50,
          intonationScore: 40,
          energyScore: 45,
          activeDuration: actualDuration,
          isSilent: false,
        };
      }

      const arrayBuf = await blob.arrayBuffer();
      const ok = await onSubmitRecording({
        buffer: arrayBuf,
        mimeType: blob.type || 'audio/webm;codecs=opus',
        duration: actualDuration,
        analysis,
      });

      if (!ok) {
        setUploadErr('Не удалось передать аудио на сервер.');
      } else {
        soundFx.pop();
      }
    } catch {
      setUploadErr('Ошибка при обработке аудиозаписи.');
    } finally {
      setUploading(false);
      stoppingRef.current = false;
    }
  }, [stopRecording, elapsedSec, originalBuffer, onSubmitRecording]);

  useEffect(() => {
    if (isRecording && elapsedSec >= maxSec && !stoppingRef.current) {
      handleStopAndSend();
    }
  }, [isRecording, elapsedSec, maxSec, handleStopAndSend]);

  const beginWithCountdown = async () => {
    if (countdown !== null || isRecording || uploading) return;
    setUploadErr(null);
    setCountdown(3);
    soundFx.beep(540, 0.08, 0.06);

    setTimeout(() => {
      setCountdown(2);
      soundFx.beep(660, 0.08, 0.06);
    }, 600);
    setTimeout(() => {
      setCountdown(1);
      soundFx.beep(780, 0.08, 0.06);
    }, 1200);
    setTimeout(async () => {
      setCountdown(null);
      soundFx.startRecord();
      await startRecording();
    }, 1800);
  };

  const timeLeft = Math.max(0, maxSec - elapsedSec);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 space-y-4">
      {/* Header */}
      <div className="party-card rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
            Раунд {room.currentRound}/{room.settings.totalRounds} • Запись пародии
          </div>
          <h2 className="font-display text-2xl font-black text-white">
            {isSequential
              ? isMyTurn
                ? 'Твой выход на сцену!'
                : `Выступает ${activeTurnPlayer?.nickname || '...'}`
              : 'Попадай в волну оригинала!'}
          </h2>
        </div>
        <PhaseCountdown phaseEndsAt={room.phaseEndsAt} />
      </div>

      {/* In Sequential mode, show live Concert Stage */}
      {isSequential && (
        <ConcertStage
          players={room.players}
          activePlayerId={room.activeTurnPlayerId}
          speakerVolume={isMyTurn ? micLevel : 0.25}
          meme={meme}
          myPlayerId={me.id}
        />
      )}

      {/* Main Recorder Card */}
      <div className="party-card rounded-3xl p-5 sm:p-6 flex flex-col items-center text-center space-y-5">
        {myRec ? (
          <div className="space-y-4 w-full max-w-md py-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white">
              {myRec.skipped ? 'Ты пропустил этот раунд' : 'Запись отправлена в эфир!'}
            </h3>
            {!myRec.skipped && localPreviewUrl && (
              <div className="rounded-2xl bg-black/30 p-3 border border-white/10">
                <audio controls src={localPreviewUrl} className="w-full h-10" />
              </div>
            )}
            <p className="text-xs sm:text-sm text-white/65">
              Ждём остальных участников — скоро начнётся Галерея славы!
            </p>
          </div>
        ) : !isMyTurn ? (
          <p className="text-sm font-bold text-white/70 py-4">
            Сейчас записывает {activeTurnPlayer?.nickname}. Приготовься — ты следующий!
          </p>
        ) : (
          <>
            {/* Meme reminder */}
            {meme && (
              <div className="flex items-center gap-2.5 rounded-full bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-amber-200">
                <span>{meme.emoji}</span>
                <span>{meme.promptHint}</span>
              </div>
            )}

            {/* Karaoke Waveform Overlay Canvas */}
            <WaveformOverlayRecorder
              originalPeaks={originalPeaks}
              originalDuration={originalBuffer?.duration || meme?.duration || 4}
              maxRecordSec={maxSec}
              isRecording={isRecording}
              elapsedSec={elapsedSec}
              micLevel={micLevel}
            />

            {/* Status Strip */}
            {isRecording && (
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-400/50 px-4 py-1 text-xs font-extrabold text-rose-200">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400 animate-ping" />
                <span>Запись идёт • Осталось {timeLeft.toFixed(1)}с</span>
              </div>
            )}

            {countdown !== null && (
              <div className="font-display text-5xl font-black text-amber-300 animate-bounce">
                {countdown}...
              </div>
            )}

            {/* Mic Error Banner */}
            {micError && (
              <div className="w-full rounded-2xl bg-rose-500/20 border border-rose-400/50 p-4 text-left space-y-2">
                <div className="flex items-center gap-2 font-display font-bold text-rose-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
                  <span>{micError.message}</span>
                </div>
                <p className="text-xs text-rose-100/80">{micError.hint}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetError();
                      beginWithCountdown();
                    }}
                    className="party-btn-cyan text-xs px-3.5 py-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Повторить</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSkipRecording}
                    className="party-btn-ghost text-xs px-3.5 py-2"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    <span>Без микрофона</span>
                  </button>
                </div>
              </div>
            )}

            {uploadErr && (
              <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-4 py-2 text-xs font-bold text-amber-200">
                {uploadErr}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  disabled={uploading || countdown !== null}
                  onClick={beginWithCountdown}
                  className="party-btn-primary px-8 py-4 text-lg rounded-full"
                >
                  <Mic className="h-6 w-6" />
                  <span>
                    {uploading
                      ? 'Анализ голоса...'
                      : countdown !== null
                      ? 'Приготовься...'
                      : 'Записать голос'}
                  </span>
                </button>
              ) : (
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-pulse-ring pointer-events-none" />
                  <button
                    type="button"
                    onClick={handleStopAndSend}
                    className="relative inline-flex items-center gap-3 rounded-full bg-rose-600 hover:bg-rose-500 px-8 py-4 font-display font-bold text-lg text-white shadow-xl border-b-4 border-rose-800 active:border-b-0 active:translate-y-1 transition"
                  >
                    <Square className="h-5 w-5 fill-current" />
                    <span>Стоп и отправить!</span>
                  </button>
                </div>
              )}

              {!isRecording && !uploading && countdown === null && (
                <button
                  type="button"
                  onClick={onSkipRecording}
                  className="party-btn-ghost text-xs text-white/65"
                >
                  <SkipForward className="h-4 w-4" />
                  <span>Пропустить</span>
                </button>
              )}
            </div>

            {micActive && !isRecording && (
              <span className="text-[11px] font-bold text-emerald-300">Микрофон подключён</span>
            )}
          </>
        )}
      </div>

      {/* Compact Player Readiness Bar */}
      <div className="party-card rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {room.players.map((p) => {
            const rec = room.recordings[p.id];
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 border text-xs font-bold ${
                  rec
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-white/65'
                }`}
              >
                <span>{p.nickname}</span>
                <span>{rec ? (rec.skipped ? '🙈' : '✅') : '⏳'}</span>
              </div>
            );
          })}
        </div>
        {me.isHost && (
          <button
            type="button"
            onClick={onForceFinish}
            className="party-btn-ghost text-xs px-3 py-1.5 text-amber-300 border-amber-400/30"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span>К прослушиванию</span>
          </button>
        )}
      </div>
    </div>
  );
};
