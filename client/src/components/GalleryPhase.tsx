import React, { useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Award,
} from 'lucide-react';
import { Player, REACTION_EMOJIS, RoomState } from '../types/game';
import { LocalRecordingMedia } from '../hooks/useSocket';
import { useStageAudioPlayer } from '../hooks/useStageAudioPlayer';
import { ConcertStage } from './ConcertStage';
import { resolveMediaUrl } from '../utils/serverUrl';
import { soundFx } from '../utils/soundFx';

interface GalleryPhaseProps {
  room: RoomState;
  me: Player;
  recordingMedia: Record<string, LocalRecordingMedia>;
  onGalleryNavigate: (action: 'next' | 'prev' | 'replay' | 'ended') => void;
  onSendReaction: (emoji: string, targetPlayerId: string | null) => void;
}

export const GalleryPhase: React.FC<GalleryPhaseProps> = ({
  room,
  me,
  recordingMedia,
  onGalleryNavigate,
  onSendReaction,
}) => {
  const { gallery, selectedMeme } = room;
  const currentItem = gallery.items[gallery.stepIndex];
  const endedTimerRef = useRef<number | null>(null);

  const currentPlayer =
    currentItem?.kind === 'player'
      ? room.players.find((p) => p.id === currentItem.playerId) || null
      : null;

  const scheduleAutoEnded = useCallback(() => {
    if (!me.isHost) return;
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    endedTimerRef.current = window.setTimeout(() => {
      onGalleryNavigate('ended');
    }, 1100);
  }, [me.isHost, onGalleryNavigate]);

  const { volume, needsClick, playSource, stop } = useStageAudioPlayer(scheduleAutoEnded);

  useEffect(() => {
    return () => {
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
      stop();
    };
  }, [stop]);

  const startCurrentClip = useCallback(() => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    if (!currentItem) return;

    if (currentItem.kind === 'original' && selectedMeme?.url) {
      playSource(resolveMediaUrl(selectedMeme.url));
    } else if (currentItem.kind === 'player') {
      const media = recordingMedia[currentItem.playerId];
      if (media?.blob) {
        playSource(media.blob);
      }
    }
  }, [currentItem, selectedMeme?.url, recordingMedia, playSource]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      startCurrentClip();
    }, 220);
    return () => clearTimeout(t);
  }, [gallery.stepIndex, gallery.playToken, startCurrentClip]);

  const isLastStep = gallery.stepIndex >= gallery.items.length - 1;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 space-y-4">
      {/* Header */}
      <div className="party-card rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <Sparkles className="h-4 w-4" />
            <span>Галерея славы • Раунд {room.currentRound}</span>
          </div>
          <h2 className="font-display text-2xl font-black text-white">
            {currentItem?.kind === 'original'
              ? 'Слушаем оригинал!'
              : `На сцене: ${currentPlayer?.nickname || 'Артист'}!`}
          </h2>
        </div>

        <div className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white/85">
          {gallery.stepIndex + 1} / {gallery.items.length}
        </div>
      </div>

      {/* Queue Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {gallery.items.map((item, idx) => {
          const active = idx === gallery.stepIndex;
          const p =
            item.kind === 'player' ? room.players.find((pl) => pl.id === item.playerId) : null;
          return (
            <div
              key={idx}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border transition ${
                active
                  ? 'bg-gradient-to-r from-fuchsia-500 to-amber-400 text-slate-950 border-white shadow-lg'
                  : idx < gallery.stepIndex
                  ? 'bg-white/15 border-white/20 text-white/80'
                  : 'bg-white/5 border-white/10 text-white/45'
              }`}
            >
              <span>{item.kind === 'original' ? '🎬 Оригинал' : p?.nickname}</span>
            </div>
          );
        })}
      </div>

      {/* Interactive Concert Stage with Real-time AnalyserNode Mouth & Spotlight */}
      <ConcertStage
        players={room.players}
        activePlayerId={currentPlayer?.id || null}
        isOriginalActive={currentItem?.kind === 'original'}
        speakerVolume={volume}
        meme={selectedMeme}
        myPlayerId={me.id}
      />

      {needsClick && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={startCurrentClip}
            className="party-btn-cyan text-sm px-6 py-2.5"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Включить звук выступления</span>
          </button>
        </div>
      )}

      {/* Reactions + Host Controls */}
      <div className="party-card rounded-3xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-white/70">
            Кидай реакции на сцену (+бонус к баллам):
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  soundFx.pop();
                  onSendReaction(emoji, currentPlayer ? currentPlayer.id : null);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-90 text-2xl transition-all border border-white/15 shadow"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {me.isHost && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={gallery.stepIndex === 0}
                onClick={() => {
                  if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
                  stop();
                  onGalleryNavigate('prev');
                }}
                className="party-btn-ghost text-xs sm:text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Назад</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
                  onGalleryNavigate('replay');
                }}
                className="party-btn-ghost text-xs sm:text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Повтор</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
                stop();
                onGalleryNavigate('next');
              }}
              className="party-btn-primary text-sm"
            >
              {isLastStep ? (
                <>
                  <Award className="h-5 w-5" />
                  <span>К оценкам!</span>
                </>
              ) : (
                <>
                  <span>Следующий</span>
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
