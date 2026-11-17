import React, { useEffect, useState } from 'react';
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
  Mic,
  MicOff,
  AlertTriangle,
} from 'lucide-react';
import {
  CHARACTER_CATALOG,
  CharacterId,
  MemeItem,
  Player,
  RoomSettings,
  RoomState,
} from '../types/game';
import { PlayerAvatar } from './PlayerAvatar';
import { CharacterPicker } from './CharacterPicker';
import { MemePackModal } from './MemePackModal';
import { useMediaStream } from '../contexts/MediaStreamContext';
import { resolveMediaUrl } from '../utils/serverUrl';
import { soundFx } from '../utils/soundFx';

interface LobbyScreenProps {
  room: RoomState;
  me: Player;
  onSelectCharacter: (characterId: CharacterId) => void;
  onToggleReady: () => void;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
  onTogglePackMeme: (memeId: string) => void;
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
  onSelectCharacter,
  onToggleReady,
  onUpdateSettings,
  onTogglePackMeme,
  onStartGame,
  onLeaveRoom,
  onAddCustomMeme,
  onRemoveCustomMeme,
}) => {
  const { micStatus, micError, micLevel, requestMicrophone } = useMediaStream();
  const [copied, setCopied] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [builtinMemes, setBuiltinMemes] = useState<MemeItem[]>([]);

  useEffect(() => {
    fetch(resolveMediaUrl('/api/memes'))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.memes)) setBuiltinMemes(data.memes);
      })
      .catch(() => {});
  }, []);

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

  const activePackCount =
    room.customMemes.length + room.settings.enabledBuiltinMemeIds.length;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-4 space-y-4">
      {/* Room Code Banner */}
      <div className="party-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
            Код комнаты • Голосовой чат включён
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
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

        <button
          type="button"
          onClick={onLeaveRoom}
          className="party-btn-ghost text-xs sm:text-sm text-rose-200 hover:bg-rose-500/20 border-rose-400/25"
        >
          <LogOut className="h-4 w-4" />
          <span>Выйти</span>
        </button>
      </div>

      {/* Persistent Microphone Check & Permission Banner */}
      {micStatus !== 'granted' ? (
        <div className="rounded-3xl bg-rose-500/20 border border-rose-400/50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-display font-bold text-sm sm:text-base text-white">
                {micError?.message || 'Нужен доступ к микрофону для записи и чата'}
              </div>
              <p className="text-xs text-rose-100/80 mt-0.5">
                {micError?.hint ||
                  'Разрешите микрофон один раз в лобби — во время раундов запись пойдёт автоматически без задержек!'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => requestMicrophone()}
            className="party-btn-cyan text-xs sm:text-sm px-4 py-2.5 shrink-0 w-full sm:w-auto"
          >
            <Mic className="h-4 w-4" />
            <span>Включить микрофон</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/35 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
            <Mic className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Микрофон готов к автозаписи и голосовому чату</span>
          </div>
          <div className="flex items-center gap-2 w-28 sm:w-40">
            <div className="h-2 flex-1 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all duration-75"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Real-time Synchronized Character Picker */}
      <div className="party-card rounded-3xl p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base sm:text-lg font-bold text-white">
            Выбор персонажа (синхронизировано)
          </h2>
          <span className="text-xs font-bold text-cyan-300">
            Твой герой: {CHARACTER_CATALOG[me.characterId]?.name}
          </span>
        </div>
        <CharacterPicker
          selectedId={me.characterId}
          onSelect={onSelectCharacter}
          players={room.players}
          myPlayerId={me.id}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Players List */}
        <div className="lg:col-span-6 party-card rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-fuchsia-400" />
              Игроки ({room.players.length}/10)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {room.players.map((p) => {
              const isMe = p.id === me.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2.5 rounded-2xl p-2 border transition-all ${
                    isMe
                      ? 'bg-fuchsia-500/15 border-fuchsia-400/45'
                      : 'bg-black/25 border-white/10'
                  }`}
                >
                  <PlayerAvatar player={p} size={44} highlight={isMe} />
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">{p.nickname}</div>
                    <div className="text-[11px] font-semibold">
                      {p.isHost ? (
                        <span className="text-amber-300 inline-flex items-center gap-1">
                          <Crown className="h-3 w-3" /> Хост
                        </span>
                      ) : !p.connected ? (
                        <span className="text-rose-300">Переподключение...</span>
                      ) : p.isReady ? (
                        <span className="text-emerald-300">Готов!</span>
                      ) : (
                        <span className="text-white/50">В лобби</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings + Meme Pack Pool */}
        <div className="lg:col-span-6 party-card rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Settings className="h-5 w-5 text-cyan-400" />
                Авто-настройки игры
              </h2>
              <button
                type="button"
                onClick={() => setPackOpen(true)}
                className="party-btn-cyan text-xs px-3 py-1.5"
              >
                <Music className="h-3.5 w-3.5" />
                <span>Загрузить свои ({room.customMemes.length})</span>
              </button>
            </div>

            {/* Rounds */}
            <div>
              <div className="flex justify-between text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                <span>Количество раундов</span>
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

            {/* Recording Mode */}
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                Режим записи (длительность = длительности мема)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!me.isHost}
                  onClick={() => onUpdateSettings({ recordingMode: 'parallel' })}
                  className={`rounded-xl p-2 text-left border transition ${
                    room.settings.recordingMode === 'parallel'
                      ? 'bg-fuchsia-500/25 border-fuchsia-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10 disabled:opacity-60'
                  }`}
                >
                  <div className="font-display font-bold text-xs sm:text-sm">⚡ Все сразу</div>
                  <div className="text-[10px] opacity-75">Динамичный авто-ритм</div>
                </button>
                <button
                  type="button"
                  disabled={!me.isHost}
                  onClick={() => onUpdateSettings({ recordingMode: 'sequential' })}
                  className={`rounded-xl p-2 text-left border transition ${
                    room.settings.recordingMode === 'sequential'
                      ? 'bg-fuchsia-500/25 border-fuchsia-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10 disabled:opacity-60'
                  }`}
                >
                  <div className="font-display font-bold text-xs sm:text-sm">🎤 По очереди</div>
                  <div className="text-[10px] opacity-75">Один за другим</div>
                </button>
              </div>
            </div>

            {/* Built-in + Custom Meme Pack Pool */}
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
                <span>Пак мемов без повторов</span>
                <span className="text-cyan-300">Активно: {activePackCount}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {room.customMemes.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 rounded-full bg-cyan-500/25 border border-cyan-400/50 px-2.5 py-1 text-[11px] font-bold text-cyan-100"
                  >
                    <span>{m.emoji}</span>
                    <span className="truncate max-w-[110px]">{m.title}</span>
                  </span>
                ))}
                {builtinMemes.map((m) => {
                  const enabled = room.settings.enabledBuiltinMemeIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!me.isHost}
                      onClick={() => onTogglePackMeme(m.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
                        enabled
                          ? 'bg-white/15 border-white/30 text-white'
                          : 'bg-black/30 border-white/5 text-white/35 line-through'
                      } disabled:cursor-default`}
                    >
                      <span>{m.emoji}</span>
                      <span>{m.title}</span>
                    </button>
                  );
                })}
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
                className="party-btn-primary w-full text-base sm:text-lg"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Начать авто-игру ({room.settings.totalRounds} раунд.)</span>
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
                    ? 'party-btn-ghost w-full py-3 text-emerald-300 border-emerald-400/40'
                    : 'party-btn-cyan w-full text-base'
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
                    <span>Готов к игре!</span>
                  </>
                )}
              </button>
            )}

            {micStatus === 'denied' && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-rose-300">
                <MicOff className="h-3.5 w-3.5" />
                <span>Микрофон выключен — вы сможете слушать, но не записывать</span>
              </div>
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
