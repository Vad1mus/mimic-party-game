import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Sparkles } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { PlayerAvatar } from './PlayerAvatar';
import { PhaseCountdown } from './PhaseCountdown';
import { soundFx } from '../utils/soundFx';

interface RoundResultsScreenProps {
  room: RoomState;
  me: Player;
}

export const RoundResultsScreen: React.FC<RoundResultsScreenProps> = ({ room, me }) => {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const isFinalRound = room.currentRound >= room.settings.totalRounds;

  useEffect(() => {
    soundFx.fanfare();
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 py-3 sm:py-5 space-y-4">
      <div className="party-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            <span>
              Итоги раунда {room.currentRound} из {room.settings.totalRounds}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">
            {isFinalRound ? 'Скоро откроем подиум!' : 'Следующий раунд через...'}
          </h2>
        </div>

        <PhaseCountdown phaseEndsAt={room.phaseEndsAt} urgentBelow={3} />
      </div>

      {/* Combined Round Score Breakdown + Leaderboard */}
      <div className="space-y-2.5">
        {sorted.map((p, idx) => {
          const isMe = p.id === me.id;
          const sc = room.scores[p.id];
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`party-card rounded-2xl p-3 sm:p-4 space-y-2 ${
                idx === 0
                  ? 'border-amber-400/55 bg-gradient-to-r from-amber-500/15 to-fuchsia-500/10'
                  : isMe
                  ? 'border-cyan-400/45 bg-cyan-500/10'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 font-display text-base font-black">
                    {medal}
                  </div>
                  <PlayerAvatar player={p} size={44} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-bold text-sm sm:text-base text-white truncate">
                        {p.nickname}
                      </span>
                      {idx === 0 && <Crown className="h-3.5 w-3.5 text-amber-300 shrink-0" />}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-300">
                      +{p.lastRoundDelta} за раунд{' '}
                      {sc ? (
                        <span className="text-amber-300 ml-1">• {sc.similarity}% схожесть</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-display text-xl sm:text-2xl font-black text-white">
                    {p.score}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-white/50">баллов</div>
                </div>
              </div>

              {sc && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-1.5 text-[11px] font-bold">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-cyan-300">Тайминг: {sc.timingScore}%</span>
                    <span className="text-white/25">|</span>
                    <span className="text-fuchsia-300">Интонация: {sc.intonationScore}%</span>
                    <span className="text-white/25">|</span>
                    <span className="text-emerald-300">Энергия: {sc.energyScore}%</span>
                  </div>
                  <span className="text-white/80 inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    {sc.verdict}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
