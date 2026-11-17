import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Sparkles, Users, ArrowRight, PlusCircle, LogIn } from 'lucide-react';
import { CharacterId } from '../types/game';
import { CharacterPicker } from './CharacterPicker';
import { useMediaStream } from '../contexts/MediaStreamContext';
import { soundFx } from '../utils/soundFx';

interface HomeScreenProps {
  connected: boolean;
  error: string | null;
  onClearError: () => void;
  onCreateRoom: (nickname: string, characterId: CharacterId) => Promise<boolean>;
  onJoinRoom: (code: string, nickname: string, characterId: CharacterId) => Promise<boolean>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  connected,
  error,
  onClearError,
  onCreateRoom,
  onJoinRoom,
}) => {
  const { requestMicrophone } = useMediaStream();
  const [nickname, setNickname] = useState(() => sessionStorage.getItem('mimic_nickname') || '');
  const [characterId, setCharacterId] = useState<CharacterId>(
    () => (sessionStorage.getItem('mimic_character') as CharacterId) || 'fox'
  );
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase().slice(0, 6);
  });
  const [mode, setMode] = useState<'join' | 'create'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') ? 'join' : 'create';
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || submitting) return;
    soundFx.pop();
    setSubmitting(true);

    // Request persistent MediaStream & unlock AudioContext ONCE on user click!
    void requestMicrophone();

    if (mode === 'create') {
      await onCreateRoom(nickname.trim(), characterId);
    } else {
      await onJoinRoom(roomCode.trim().toUpperCase(), nickname.trim(), characterId);
    }
    setSubmitting(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-3 sm:px-4 py-5 sm:py-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 text-center"
      >
        <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 px-3.5 py-1 text-xs font-bold text-fuchsia-200 shadow">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>Онлайн пати-шоу • До 10 друзей</span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-[0_6px_24px_rgba(236,72,153,0.45)]">
          MIMIC{' '}
          <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
            VOICE PARTY
          </span>
        </h1>
        <p className="mt-1.5 max-w-md mx-auto text-xs sm:text-sm text-white/75 font-semibold">
          Выбери героя, повторяй мемы по волне оригинала и общайся в голосовом чате между раундами!
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="party-card w-full max-w-xl rounded-3xl p-4 sm:p-6"
      >
        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-1.5 mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              onClearError();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-display font-bold transition-all ${
              mode === 'create'
                ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-md'
                : 'text-white/65 hover:text-white'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            Создать комнату
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join');
              onClearError();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-display font-bold transition-all ${
              mode === 'join'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-md'
                : 'text-white/65 hover:text-white'
            }`}
          >
            <LogIn className="h-4 w-4" />
            Войти по коду
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={mode === 'create' ? 'sm:col-span-2' : ''}>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/70 mb-1">
                Твой никнейм
              </label>
              <input
                type="text"
                maxLength={20}
                required
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) onClearError();
                }}
                placeholder="Например: КапибараПро"
                className="w-full rounded-2xl bg-black/35 border border-white/15 px-3.5 py-3 text-sm sm:text-base font-bold text-white placeholder-white/35 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/30 transition"
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/70 mb-1">
                  Код комнаты
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    if (error) onClearError();
                  }}
                  placeholder="K7M9X"
                  className="w-full rounded-2xl bg-black/35 border border-white/15 px-3.5 py-3 text-center font-display text-lg tracking-[0.22em] font-black text-cyan-300 placeholder-white/25 uppercase focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition"
                />
              </div>
            )}
          </div>

          {/* Manual Character Selection Grid */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
              Выбери персонажа
            </label>
            <CharacterPicker selectedId={characterId} onSelect={setCharacterId} />
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              !connected ||
              submitting ||
              !nickname.trim() ||
              (mode === 'join' && roomCode.trim().length < 3)
            }
            className={
              mode === 'create'
                ? 'party-btn-primary w-full text-base sm:text-lg'
                : 'party-btn-cyan w-full text-base sm:text-lg'
            }
          >
            {submitting ? (
              <span>Подключаемся...</span>
            ) : mode === 'create' ? (
              <>
                <Mic className="h-5 w-5" />
                <span>Создать вечеринку</span>
                <ArrowRight className="h-5 w-5" />
              </>
            ) : (
              <>
                <Users className="h-5 w-5" />
                <span>Войти на сцену</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          {!connected && (
            <p className="text-center text-xs font-bold text-amber-300 animate-pulse">
              Подключение к серверу... (на бесплатном хостинге первый запуск занимает до 25 сек)
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
};
