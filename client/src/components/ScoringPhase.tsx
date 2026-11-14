import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, ArrowRight, Play, Sparkles } from 'lucide-react';
import { Player, REACTION_EMOJIS, RoomState } from '../types/game';
import { LocalRecordingMedia } from '../hooks/useSocket';
import { PlayerAvatar } from './PlayerAvatar';
import { PhaseCountdown } from './PhaseCountdown';
import { soundFx } from '../utils/soundFx';

interface ScoringPhaseProps {
  room: RoomState;
  me: Player;
  recordingMedia: Record<string, LocalRecordingMedia>;
  onSendReaction: (emoji: string, targetPlayerId: string | null) => void;
  onAdvanceToResults: () => void;
}

const AnimatedSimilarityBar: React.FC<{ target: number; color: string }> = ({ target, color }) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 950;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-white/70">
          Итоговое совпадение
        </span>
        <span className="font-display text-3xl font-black text-amber-300">{val}%</span>
      </div>
      <div className="h-4 w-full rounded-full bg-black/45 border border-white/10 p-0.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${val}%`,
            background: `linear-gradient(90deg, ${color}, #f59e0b, #22d3ee)`,
          }}
        />
      </div>
    </div>
  );
};

export const ScoringPhase: React.FC<ScoringPhaseProps> = ({
  room,
  me,
  recordingMedia,
  onSendReaction,
  onAdvanceToResults,
}) => {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    soundFx.fanfare();
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const rankedPlayers = [...room.players].sort((a, b) => {
    const sa = room.scores[a.id]?.totalRoundPoints ?? 0;
    const sb = room.scores[b.id]?.totalRoundPoints ?? 0;
    return sb - sa;
  });

  const playClip = (playerId: string) => {
    const url = recordingMedia[playerId]?.url;
    if (!url) return;
    audioRef.current?.pause();
    if (playingAudioId === playerId) {
      setPlayingAudioId(null);
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAudioId(playerId);
    audio.onended = () => setPlayingAudioId(null);
    audio.play().catch(() => setPlayingAudioId(null));
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 space-y-5">
      <div className="party-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <Award className="h-4 w-4" />
            <span>Web Audio Анализ • Раунд {room.currentRound}</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-white mt-0.5">
            Результаты и расшифровка
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <PhaseCountdown phaseEndsAt={room.phaseEndsAt} />
          {me.isHost && (
            <button type="button" onClick={onAdvanceToResults} className="party-btn-primary text-sm">
              <span>Лидеры</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rankedPlayers.map((player, idx) => {
          const score = room.scores[player.id];
          const media = recordingMedia[player.id];
          if (!score) return null;

          const reactionEntries = Object.entries(score.reactionCounts || {});

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: idx * 0.08 }}
              className={`party-card rounded-3xl p-5 space-y-4 ${
                idx === 0 && score.similarity > 0
                  ? 'border-amber-400/60 ring-2 ring-amber-400/30'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="font-display text-lg font-black text-white/50 w-5">
                    #{idx + 1}
                  </div>
                  <PlayerAvatar player={player} size={52} />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-lg text-white truncate">
                      {player.nickname}
                    </div>
                    {idx === 0 && score.similarity > 0 && (
                      <div className="text-xs font-bold text-amber-300 inline-flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> Лучший в раунде!
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-display text-2xl font-black text-emerald-300">
                    +{score.totalRoundPoints}
                  </div>
                  {score.reactionBonus > 0 && (
                    <div className="text-[11px] font-bold text-pink-300">
                      +{score.reactionBonus} за смайлы
                    </div>
                  )}
                </div>
              </div>

              <AnimatedSimilarityBar target={score.similarity} color={player.color} />

              {/* 3-metric Web Audio API breakdown */}
              <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-xs font-extrabold flex flex-wrap items-center justify-between gap-2">
                <span className="text-cyan-300">Тайминг: {score.timingScore}%</span>
                <span className="text-white/25">|</span>
                <span className="text-fuchsia-300">Интонация: {score.intonationScore}%</span>
                <span className="text-white/25">|</span>
                <span className="text-emerald-300">Энергия: {score.energyScore}%</span>
              </div>

              <div className="rounded-xl bg-black/25 px-3.5 py-2 text-xs sm:text-sm font-bold text-white/90">
                {score.verdict}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {reactionEntries.length > 0
                    ? reactionEntries.map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold"
                        >
                          {emoji} {count}
                        </span>
                      ))
                    : REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            soundFx.pop();
                            onSendReaction(emoji, player.id);
                          }}
                          className="rounded-full bg-white/10 hover:bg-white/25 px-2 py-0.5 text-sm transition"
                        >
                          {emoji}
                        </button>
                      ))}
                </div>

                {media?.url && (
                  <button
                    type="button"
                    onClick={() => playClip(player.id)}
                    className="party-btn-ghost text-xs px-3 py-1.5"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{playingAudioId === player.id ? 'Стоп' : 'Повтор'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
