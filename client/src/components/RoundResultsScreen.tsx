import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight, Crown } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { PlayerAvatar } from './PlayerAvatar';
import { soundFx } from '../utils/soundFx';

interface RoundResultsScreenProps {
  room: RoomState;
  me: Player;
  onNextRound: () => void;
}

export const RoundResultsScreen: React.FC<RoundResultsScreenProps> = ({
  room,
  me,
  onNextRound,
}) => {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const isFinalRound = room.currentRound >= room.settings.totalRounds;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-6">
      <div className="party-card rounded-3xl p-6 text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-400/40 px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-300">
          <Trophy className="h-4 w-4" />
          <span>Итоги раунда {room.currentRound} из {room.settings.totalRounds}</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-black text-white">
          Таблица лидеров
        </h2>
      </div>

      <div className="party-card rounded-3xl p-4 sm:p-6 space-y-3">
        {sorted.map((p, idx) => {
          const isMe = p.id === me.id;
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`flex items-center justify-between gap-3 rounded-2xl p-3 border transition-all ${
                idx === 0
                  ? 'bg-gradient-to-r from-amber-500/20 to-fuchsia-500/15 border-amber-400/50'
                  : isMe
                  ? 'bg-cyan-500/15 border-cyan-400/40'
                  : 'bg-black/25 border-white/10'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 font-display text-lg font-black">
                  {medal}
                </div>
                <PlayerAvatar player={p} size={48} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-base sm:text-lg text-white truncate">
                      {p.nickname}
                    </span>
                    {idx === 0 && <Crown className="h-4 w-4 text-amber-300 shrink-0" />}
                  </div>
                  <div className="text-xs font-bold text-emerald-300">
                    +{p.lastRoundDelta} за раунд
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-display text-2xl font-black text-white">{p.score}</div>
                <div className="text-[11px] font-bold uppercase text-white/50">баллов</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-center">
        {me.isHost ? (
          <button
            type="button"
            onClick={() => {
              soundFx.pop();
              onNextRound();
            }}
            className="party-btn-primary text-lg px-8 py-4"
          >
            <span>
              {isFinalRound ? 'Объявить победителя!' : `Начать раунд ${room.currentRound + 1}`}
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <div className="rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white/75">
            Ждём, пока хост запустит {isFinalRound ? 'финал' : 'следующий раунд'}...
          </div>
        )}
      </div>
    </div>
  );
};
