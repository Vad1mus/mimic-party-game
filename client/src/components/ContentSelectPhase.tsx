import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Square,
  Shuffle,
  CheckCircle2,
  Music,
  Sparkles,
} from 'lucide-react';
import { MemeItem, Player, RoomState } from '../types/game';
import { PhaseCountdown } from './PhaseCountdown';
import { MemePackModal } from './MemePackModal';
import { resolveMediaUrl } from '../utils/serverUrl';
import { soundFx } from '../utils/soundFx';

interface ContentSelectPhaseProps {
  room: RoomState;
  me: Player;
  onSelectMeme: (memeId: string) => void;
  onAddCustomMeme: (payload: {
    title: string;
    promptHint?: string;
    emoji?: string;
    type: 'audio' | 'video';
    mimeType: string;
    duration: number;
    buffer: ArrayBuffer;
  }) => Promise<{ ok: boolean; meme?: MemeItem; error?: string }>;
  onRemoveCustomMeme: (memeId: string) => void;
}

export const ContentSelectPhase: React.FC<ContentSelectPhaseProps> = ({
  room,
  me,
  onSelectMeme,
  onAddCustomMeme,
  onRemoveCustomMeme,
}) => {
  const [builtinMemes, setBuiltinMemes] = useState<MemeItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'custom'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [packOpen, setPackOpen] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const canSelect = me.isHost || me.id === room.selectorPlayerId;
  const selectorPlayer = room.players.find((p) => p.id === room.selectorPlayerId);

  useEffect(() => {
    fetch(resolveMediaUrl('/api/memes'))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.memes)) setBuiltinMemes(data.memes);
      })
      .catch(() => {});

    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  const allMemes = [...room.customMemes, ...builtinMemes];
  const filteredMemes = filter === 'custom' ? room.customMemes : allMemes;

  const togglePreview = (meme: MemeItem) => {
    if (previewId === meme.id) {
      previewAudioRef.current?.pause();
      setPreviewId(null);
      return;
    }

    previewAudioRef.current?.pause();
    const audio = new Audio(resolveMediaUrl(meme.url));
    previewAudioRef.current = audio;
    setPreviewId(meme.id);
    audio.onended = () => setPreviewId(null);
    audio.onerror = () => setPreviewId(null);
    audio.play().catch(() => setPreviewId(null));
  };

  const pickRandom = () => {
    if (!canSelect || allMemes.length === 0) return;
    const item = allMemes[Math.floor(Math.random() * allMemes.length)];
    soundFx.pop();
    previewAudioRef.current?.pause();
    onSelectMeme(item.id);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 space-y-5">
      {/* Phase Header */}
      <div className="party-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-300">
            Раунд {room.currentRound} из {room.settings.totalRounds} • Выбор звука
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-white mt-0.5">
            {canSelect
              ? 'Выбери мем для озвучки!'
              : `${selectorPlayer?.nickname || 'Игрок'} выбирает мем...`}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPackOpen(true)}
            className="party-btn-cyan text-xs sm:text-sm px-4 py-2.5"
          >
            <Music className="h-4 w-4" />
            <span>Добавить свой звук</span>
          </button>

          {canSelect && (
            <button type="button" onClick={pickRandom} className="party-btn-amber text-xs sm:text-sm px-4 py-2.5">
              <Shuffle className="h-4 w-4" />
              <span>Случайный</span>
            </button>
          )}
          <PhaseCountdown phaseEndsAt={room.phaseEndsAt} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition ${
            filter === 'all'
              ? 'bg-white text-slate-950 shadow'
              : 'bg-white/10 text-white/75 hover:bg-white/20'
          }`}
        >
          Все мемы ({allMemes.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('custom')}
          className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition ${
            filter === 'custom'
              ? 'bg-cyan-400 text-slate-950 shadow'
              : 'bg-white/10 text-white/75 hover:bg-white/20'
          }`}
        >
          ✨ Свой пак ({room.customMemes.length})
        </button>
      </div>

      {/* Meme Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMemes.map((meme) => {
          const isPreviewing = previewId === meme.id;
          return (
            <div
              key={meme.id}
              className="party-card rounded-3xl p-4 flex flex-col justify-between gap-4 hover:border-white/30 transition-all"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow"
                    style={{
                      backgroundColor: `${meme.accentColor}30`,
                      border: `1px solid ${meme.accentColor}77`,
                    }}
                  >
                    {meme.emoji}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-display font-bold text-base text-white truncate">
                      {meme.title}
                    </h4>
                    <div className="text-[11px] font-bold text-cyan-200/80">
                      {meme.category} • {meme.duration.toFixed(1)}с
                    </div>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-white/70 leading-relaxed">{meme.description}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => togglePreview(meme)}
                  className="party-btn-ghost text-xs px-3 py-2 flex-1"
                >
                  {isPreviewing ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current text-rose-400" />
                      <span>Стоп</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current text-cyan-300" />
                      <span>Слушать</span>
                    </>
                  )}
                </button>

                {canSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      previewAudioRef.current?.pause();
                      soundFx.pop();
                      onSelectMeme(meme.id);
                    }}
                    className="party-btn-primary text-xs px-4 py-2 flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Выбрать</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredMemes.length === 0 && (
          <div className="col-span-full rounded-3xl bg-white/5 border border-white/10 p-8 text-center text-white/60">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-amber-300" />
            <p className="font-bold text-sm">В паке пока пусто. Нажми «Добавить свой звук» выше!</p>
          </div>
        )}
      </div>

      <MemePackModal
        isOpen={packOpen}
        onClose={() => setPackOpen(false)}
        customMemes={room.customMemes}
        isHost={me.isHost}
        onAddCustomMeme={onAddCustomMeme}
        onRemoveCustomMeme={onRemoveCustomMeme}
      />
    </div>
  );
};
