import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Sparkles, Users, ArrowRight, PlusCircle, LogIn } from 'lucide-react';
import { CharacterId } from '../types/game';
import { CharacterAvatar } from './CharacterAvatar';
import { soundFx } from '../utils/soundFx';

interface HomeScreenProps {
  connected: boolean;
  error: string | null;
  onClearError: () => void;
  onCreateRoom: (nickname: string) => Promise<boolean>;
  onJoinRoom: (code: string, nickname: string) => Promise<boolean>;
}

const PREVIEW_CHARS: CharacterId[] = ['fox', 'robot', 'frog', 'cat', 'alien'];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  connected,
  error,
  onClearError,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [nickname, setNickname] = useState(() => sessionStorage.getItem('mimic_nickname') || '');
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase().slice(0, 6);
  });
  const [mode, setMode] = useState<'join' | 'create'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') ? 'join' : 'create';
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeCharIdx, setActiveCharIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveCharIdx((i) => (i + 1) % PREVIEW_CHARS.length);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || submitting) return;
    soundFx.pop();
    setSubmitting(true);
    if (mode === 'create') {
      await onCreateRoom(nickname.trim());
    } else {
      await onJoinRoom(roomCode.trim().toUpperCase(), nickname.trim());
    }
    setSubmitting(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 py-6 sm:py-10">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 px-4 py-1.5 text-xs font-bold text-fuchsia-200 shadow-lg">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>Онлайн-шоу озвучки • До 10 друзей</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight text-white drop-shadow-[0_6px_24px_rgba(236,72,153,0.45)]">
          MIMIC{' '}
          <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
            VOICE PARTY
          </span>
        </h1>
        <p className="mt-2.5 max-w-lg mx-auto text-sm sm:text-base text-white/75 font-semibold">
          Получи уникального героя на сцене, попадай голосом в волну оригинала и смеши друзей в Галерее славы!
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="party-card w-full max-w-lg rounded-3xl p-5 sm:p-8"
      >
        {/* Animated Stage Character Preview */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {PREVIEW_CHARS.map((cid, idx) => (
            <motion.div
              key={cid}
              animate={{
                scale: idx === activeCharIdx ? 1.18 : 0.85,
                opacity: idx === activeCharIdx ? 1 : 0.45,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <CharacterAvatar
                characterId={cid}
                size={56}
                mouthOpen={idx === activeCharIdx ? 0.5 : 0}
                isSpeaking={idx === activeCharIdx}
              />
            </motion.div>
          ))}
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-1.5 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              onClearError();
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-display font-bold transition-all ${
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
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-display font-bold transition-all ${
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
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
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
              placeholder="Например: МемныйЛис"
              className="w-full rounded-2xl bg-black/35 border border-white/15 px-4 py-3.5 text-base font-bold text-white placeholder-white/35 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/30 transition"
            />
          </div>

          {mode === 'join' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <label className="block text-xs font-extrabold uppercase tracking-wider text-white/70 mb-1.5">
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
                className="w-full rounded-2xl bg-black/35 border border-white/15 px-4 py-3 text-center font-display text-2xl tracking-[0.25em] font-black text-cyan-300 placeholder-white/25 uppercase focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition"
              />
            </motion.div>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-4 py-3 text-sm font-bold text-rose-200">
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
              mode === 'create' ? 'party-btn-primary w-full text-lg' : 'party-btn-cyan w-full text-lg'
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
              Пробуждаем игровой сервер... (на бесплатном хостинге первый запуск занимает до 20–30 сек)
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
};
