import React, { useState } from 'react';
import {
  Copy,
  Check,
  Users,
  Settings,
  Play,
  LogOut,
  Crown,
  Sparkles,
  Share2,
  Music,
} from 'lucide-react';
import { CHARACTER_CATALOG, MemeItem, Player, RoomSettings, RoomState } from '../types/game';
import { PlayerAvatar } from './PlayerAvatar';
import { MemePackModal } from './MemePackModal';
import { soundFx } from '../utils/soundFx';

interface LobbyScreenProps {
  room: RoomState;
  me: Player;
  onToggleReady: () => void;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
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

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  me,
  onToggleReady,
  onUpdateSettings,
  onStartGame,
  onLeaveRoom,
  onAddCustomMeme,
  onRemoveCustomMeme,
}) => {
  const [copied, setCopied] = useState(false);
  const [packOpen, setPackOpen] = useState(false);

  const shareUrl = `${window.location.origin}?room=${room.code}`;

  const copyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      soundFx.pop();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const readyCount = room.players.filter((p) => p.isReady || p.isHost).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 space-y-5">
      {/* Top Room Banner */}
      <div className="party-card rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
            Код комнаты — отправь друзьям
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <span className="font-display text-3xl sm:text-4xl font-black tracking-[0.2em] text-white">
              {room.code}
            </span>
            <button
              type="button"
              onClick={() => copyCode(room.code)}
              className="party-btn-ghost text-xs px-3 py-1.5"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Скопировано!' : 'Код'}</span>
            </button>
            <button
              type="button"
              onClick={() => copyCode(shareUrl)}
              className="party-btn-ghost text-xs px-3 py-1.5"
            >
              <Share2 className="h-4 w-4" />
              <span>Ссылка</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setPackOpen(true)}
            className="party-btn-cyan text-xs sm:text-sm px-4 py-2.5"
          >
            <Music className="h-4 w-4" />
            <span>Свой пак мемов ({room.customMemes.length})</span>
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="party-btn-ghost text-sm text-rose-200 hover:bg-rose-500/20 border-rose-400/25"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Players List */}
        <div className="lg:col-span-7 party-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-fuchsia-400" />
              Артисты ({room.players.length}/10)
            </h2>
            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">
              Готовы: {readyCount}/{room.players.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {room.players.map((p) => {
              const isMe = p.id === me.id;
              const charMeta = CHARACTER_CATALOG[p.characterId];
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl p-2.5 border transition-all ${
                    isMe
                      ? 'bg-fuchsia-500/15 border-fuchsia-400/45'
                      : 'bg-black/25 border-white/10'
                  }`}
                >
                  <PlayerAvatar player={p} size={52} highlight={isMe} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white truncate">{p.nickname}</span>
                      {isMe && (
                        <span className="text-[10px] font-extrabold uppercase bg-white/15 px-1.5 py-0.5 rounded text-cyan-200">
                          Ты
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-white/55 truncate">
                      {charMeta?.name}
                    </div>
                    <div className="text-xs font-semibold">
                      {p.isHost ? (
                        <span className="text-amber-300 inline-flex items-center gap-1">
                          <Crown className="h-3 w-3" /> Хост
                        </span>
                      ) : !p.connected ? (
                        <span className="text-rose-300">Переподключение...</span>
                      ) : p.isReady ? (
                        <span className="text-emerald-300">Готов!</span>
                      ) : (
                        <span className="text-white/50">Ожидание...</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings & Start */}
        <div className="lg:col-span-5 party-card rounded-3xl p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-cyan-400" />
              Настройки шоу
            </h2>

            <div>
              <div className="flex justify-between text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                <span>Раундов</span>
                <span className="text-amber-300 text-sm">{room.settings.totalRounds}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[2, 3, 5, 7, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={!me.isHost}
                    onClick={() => onUpdateSettings({ totalRounds: val })}
                    className={`rounded-xl py-2 font-display font-bold text-sm transition ${
                      room.settings.totalRounds === val
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-white/10 text-white/75 hover:bg-white/20 disabled:opacity-60'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                <span>Лимит записи</span>
                <span className="text-cyan-300 text-sm">{room.settings.recordingTimeSec} сек</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[8, 12, 15, 20].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={!me.isHost}
                    onClick={() => onUpdateSettings({ recordingTimeSec: sec })}
                    className={`rounded-xl py-2 font-display font-bold text-sm transition ${
                      room.settings.recordingTimeSec === sec
                        ? 'bg-cyan-400 text-slate-950 shadow'
                        : 'bg-white/10 text-white/75 hover:bg-white/20 disabled:opacity-60'
                    }`}
                  >
                    {sec}с
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                Режим записи
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!me.isHost}
                  onClick={() => onUpdateSettings({ recordingMode: 'parallel' })}
                  className={`rounded-xl p-2.5 text-left border transition ${
                    room.settings.recordingMode === 'parallel'
                      ? 'bg-fuchsia-500/25 border-fuchsia-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10 disabled:opacity-60'
                  }`}
                >
                  <div className="font-display font-bold text-sm">⚡ Все сразу</div>
                  <div className="text-[11px] opacity-75">Параллельно</div>
                </button>
                <button
                  type="button"
                  disabled={!me.isHost}
                  onClick={() => onUpdateSettings({ recordingMode: 'sequential' })}
                  className={`rounded-xl p-2.5 text-left border transition ${
                    room.settings.recordingMode === 'sequential'
                      ? 'bg-fuchsia-500/25 border-fuchsia-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10 disabled:opacity-60'
                  }`}
                >
                  <div className="font-display font-bold text-sm">🎤 По очереди</div>
                  <div className="text-[11px] opacity-75">Один за другим</div>
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                Кто выбирает мем
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'host', label: 'Хост' },
                  { id: 'rotating', label: 'По кругу' },
                  { id: 'random', label: 'Рандом' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!me.isHost}
                    onClick={() =>
                      onUpdateSettings({ selectorMode: opt.id as RoomSettings['selectorMode'] })
                    }
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      room.settings.selectorMode === opt.id
                        ? 'bg-emerald-400 text-slate-950 shadow'
                        : 'bg-white/10 text-white/75 hover:bg-white/20 disabled:opacity-60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            {me.isHost ? (
              <button
                type="button"
                onClick={() => {
                  soundFx.fanfare();
                  onStartGame();
                }}
                className="party-btn-primary w-full text-lg"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Начать игру!</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundFx.pop();
                  onToggleReady();
                }}
                className={
                  me.isReady
                    ? 'party-btn-ghost w-full py-3.5 text-emerald-300 border-emerald-400/40'
                    : 'party-btn-cyan w-full text-lg'
                }
              >
                {me.isReady ? (
                  <>
                    <Check className="h-5 w-5" />
                    <span>Готов! (Отменить)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Готов к шоу!</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
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
