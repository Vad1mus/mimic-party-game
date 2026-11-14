import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Crown, RotateCcw, Sparkles, Trophy, Flame } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { CharacterAvatar } from './CharacterAvatar';
import { PlayerAvatar } from './PlayerAvatar';
import { soundFx } from '../utils/soundFx';

interface GameOverScreenProps {
  room: RoomState;
  me: Player;
  onPlayAgain: () => void;
  onLeaveRoom: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  room,
  me,
  onPlayAgain,
  onLeaveRoom,
}) => {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  useEffect(() => {
    soundFx.fanfare();
    const fire = () => {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
      });
    };
    fire();
    const t1 = window.setTimeout(fire, 750);
    const t2 = window.setTimeout(fire, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const bestMimic = [...room.players].sort(
    (a, b) => b.stats.bestSimilarity - a.stats.bestSimilarity
  )[0];
  const crowdFavorite = [...room.players].sort(
    (a, b) => b.stats.totalReactionsReceived - a.stats.totalReactionsReceived
  )[0];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card rounded-3xl p-6 sm:p-8 text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-400/50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
          <Trophy className="h-4 w-4" />
          <span>Финал шоу!</span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
          Победитель:{' '}
          <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
            {first?.nickname}
          </span>
          !
        </h1>
        <p className="text-sm sm:text-base text-white/75 font-semibold">
          Итоговый счёт: <span className="text-amber-300 font-black">{first?.score}</span> баллов
        </p>

        {/* Top 3 Podium */}
        <div className="pt-6 flex items-end justify-center gap-3 sm:gap-6">
          {second && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col items-center w-28 sm:w-36"
            >
              <CharacterAvatar characterId={second.characterId} size={76} />
              <div className="mt-1 font-display font-bold text-sm sm:text-base text-white truncate w-full">
                {second.nickname}
              </div>
              <div className="text-xs font-bold text-slate-300 mb-2">{second.score} очк.</div>
              <div className="w-full h-24 sm:h-28 rounded-t-2xl bg-gradient-to-b from-slate-300/35 to-slate-500/20 border-t-4 border-slate-300 flex items-center justify-center font-display text-3xl">
                🥈
              </div>
            </motion.div>
          )}

          {first && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col items-center w-32 sm:w-44"
            >
              <Crown className="h-9 w-9 text-amber-300 fill-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)] animate-wiggle" />
              <CharacterAvatar characterId={first.characterId} size={96} isSpeaking mouthOpen={0.4} />
              <div className="mt-1 font-display font-black text-base sm:text-xl text-amber-200 truncate w-full">
                {first.nickname}
              </div>
              <div className="text-xs sm:text-sm font-black text-amber-300 mb-2">
                {first.score} очк.
              </div>
              <div className="w-full h-32 sm:h-36 rounded-t-2xl bg-gradient-to-b from-amber-400/40 to-amber-600/20 border-t-4 border-amber-300 flex items-center justify-center font-display text-4xl shadow-lg">
                🥇
              </div>
            </motion.div>
          )}

          {third && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col items-center w-28 sm:w-36"
            >
              <CharacterAvatar characterId={third.characterId} size={72} />
              <div className="mt-1 font-display font-bold text-sm sm:text-base text-white truncate w-full">
                {third.nickname}
              </div>
              <div className="text-xs font-bold text-orange-200 mb-2">{third.score} очк.</div>
              <div className="w-full h-16 sm:h-20 rounded-t-2xl bg-gradient-to-b from-orange-400/35 to-orange-700/20 border-t-4 border-orange-400 flex items-center justify-center font-display text-2xl">
                🥉
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Awards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bestMimic && bestMimic.stats.bestSimilarity > 0 && (
          <div className="party-card rounded-3xl p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                Рекорд совпадения
              </div>
              <div className="font-display font-bold text-lg text-white">
                {bestMimic.nickname} — {bestMimic.stats.bestSimilarity}%
              </div>
            </div>
          </div>
        )}

        {crowdFavorite && (
          <div className="party-card rounded-3xl p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-300">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                Любимец публики
              </div>
              <div className="font-display font-bold text-lg text-white">
                {crowdFavorite.nickname} ({crowdFavorite.stats.totalReactionsReceived} смайлов)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Leaderboard */}
      <div className="party-card rounded-3xl p-5 space-y-2.5">
        <h3 className="font-display text-lg font-bold text-white mb-2">Полный рейтинг</h3>
        {sorted.map((p, idx) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-2xl bg-black/25 border border-white/10 px-4 py-2"
          >
            <div className="flex items-center gap-3">
              <span className="font-display font-black text-white/50 w-5">{idx + 1}.</span>
              <PlayerAvatar player={p} size={36} showBadge={false} />
              <span className="font-bold text-white">{p.nickname}</span>
            </div>
            <span className="font-display font-black text-amber-300">{p.score} очк.</span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {me.isHost ? (
          <button
            type="button"
            onClick={() => {
              soundFx.pop();
              onPlayAgain();
            }}
            className="party-btn-primary text-lg px-8 py-4 w-full sm:w-auto"
          >
            <RotateCcw className="h-5 w-5" />
            <span>Сыграть еще раз!</span>
          </button>
        ) : (
          <div className="rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white/75">
            Ждём решения хоста о новой игре...
          </div>
        )}

        <button type="button" onClick={onLeaveRoom} className="party-btn-ghost px-6 py-3.5">
          Выйти в меню
        </button>
      </div>
    </div>
  );
};
