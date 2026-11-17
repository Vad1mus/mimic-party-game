import React, { useCallback, useEffect, useRef } from 'react';
import { Sparkles, Play } from 'lucide-react';
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
  onClipEnded: () => void;
  onSendReaction: (emoji: string, targetPlayerId: string | null) => void;
}

export const GalleryPhase: React.FC<GalleryPhaseProps> = ({
  room,
  me,
  recordingMedia,
  onClipEnded,
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
      onClipEnded();
    }, 850);
  }, [me.isHost, onClipEnded]);

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
    }, 180);
    return () => clearTimeout(t);
  }, [gallery.stepIndex, gallery.playToken, startCurrentClip]);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="party-card rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Галерея славы • Раунд {room.currentRound}</span>
          </div>
          <h2 className="font-display text-lg sm:text-2xl font-black text-white truncate">
            {currentItem?.kind === 'original'
              ? 'Слушаем оригинал!'
              : `На сцене: ${currentPlayer?.nickname || 'Артист'}!`}
          </h2>
        </div>

        <div className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs sm:text-sm font-bold text-white/85">
          {gallery.stepIndex + 1} / {gallery.items.length}
        </div>
      </div>

      {/* Queue Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {gallery.items.map((item, idx) => {
          const active = idx === gallery.stepIndex;
          const p =
            item.kind === 'player' ? room.players.find((pl) => pl.id === item.playerId) : null;
          return (
            <div
              key={idx}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold border transition ${
                active
                  ? 'bg-gradient-to-r from-fuchsia-500 to-amber-400 text-slate-950 border-white shadow'
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

      {/* Interactive Concert Stage */}
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
            className="party-btn-cyan text-sm px-5 py-2"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Включить звук сцены</span>
          </button>
        </div>
      )}

      {/* Reactions Bar */}
      <div className="party-card rounded-3xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/70">
          Реакции зала (+бонус к баллам):
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
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-90 text-xl sm:text-2xl transition-all border border-white/15 shadow"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
