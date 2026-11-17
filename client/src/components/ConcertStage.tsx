import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Mic, Volume2 } from 'lucide-react';
import { AudienceMood, MemeItem, Player, ReactionEvent } from '../types/game';
import { CharacterAvatar } from './CharacterAvatar';

interface ConcertStageProps {
  players: Player[];
  activePlayerId?: string | null;
  isOriginalActive?: boolean;
  speakerVolume?: number; // 0..1 real-time AnalyserNode value
  meme?: MemeItem | null;
  myPlayerId?: string;
  reactions?: ReactionEvent[];
}

function emojiToMood(emoji: string): AudienceMood {
  if (emoji === '😂') return 'laugh';
  if (emoji === '😭' || emoji === '💀') return 'cry';
  if (emoji === '😮' || emoji === '🤯') return 'surprised';
  if (emoji === '🔥' || emoji === '👏') return 'cheer';
  return 'laugh';
}

export const ConcertStage: React.FC<ConcertStageProps> = ({
  players,
  activePlayerId = null,
  isOriginalActive = false,
  speakerVolume = 0,
  meme = null,
  myPlayerId,
  reactions = [],
}) => {
  const hasSpotlight = Boolean(activePlayerId) || isOriginalActive;
  const activePlayer = players.find((p) => p.id === activePlayerId) || null;
  const backRowPlayers = activePlayer
    ? players.filter((p) => p.id !== activePlayer.id)
    : players;

  // Map latest reaction per player for live animated audience expressions
  const reactionMoodByPlayer = useMemo(() => {
    const map: Record<string, { mood: AudienceMood; emoji: string }> = {};
    for (const r of reactions) {
      map[r.fromPlayerId] = {
        mood: emojiToMood(r.emoji),
        emoji: r.emoji,
      };
    }
    return map;
  }, [reactions]);

  // Screen shake on loud vocal peaks
  const shakeOffset =
    hasSpotlight && speakerVolume > 0.72
      ? {
          x: (speakerVolume - 0.72) * 18 * (Math.random() > 0.5 ? 1 : -1),
          y: (speakerVolume - 0.72) * 12 * (Math.random() > 0.5 ? 1 : -1),
        }
      : { x: 0, y: 0 };

  return (
    <motion.div
      animate={shakeOffset}
      transition={{ duration: 0.05 }}
      className="relative w-full overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#170c38] via-[#1f1049] to-[#120829] shadow-2xl"
    >
      {/* Overhead Concert Truss Lights */}
      <div className="relative h-5 w-full border-b border-white/10 bg-black/50 flex items-center justify-around px-4">
        {['#ec4899', '#22d3ee', '#f59e0b', '#a855f7', '#10b981'].map((col, i) => (
          <motion.div
            key={i}
            animate={
              hasSpotlight
                ? { opacity: [0.65, 1, 0.65], scale: [1, 1.15, 1] }
                : { opacity: 0.45 }
            }
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 }}
            className="h-2 w-5 sm:w-7 rounded-b-full"
            style={{
              backgroundColor: col,
              boxShadow: `0 4px 16px ${col}`,
            }}
          />
        ))}
      </div>

      {/* Sweeping Side Beams */}
      <motion.div
        animate={{ rotate: hasSpotlight ? [-6, 6, -6] : [-2, 2, -2] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-6 left-4 h-72 w-32 origin-top opacity-25"
        style={{
          background: 'linear-gradient(to bottom, rgba(34,211,238,0.45), transparent)',
          clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
        }}
      />
      <motion.div
        animate={{ rotate: hasSpotlight ? [6, -6, 6] : [2, -2, 2] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-6 right-4 h-72 w-32 origin-top opacity-25"
        style={{
          background: 'linear-gradient(to bottom, rgba(236,72,153,0.45), transparent)',
          clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
        }}
      />

      {/* Main Center Spotlight Cone */}
      {hasSpotlight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.72 + speakerVolume * 0.28 }}
          className="pointer-events-none absolute inset-x-0 top-4 mx-auto h-80 w-72 sm:w-[420px]"
          style={{
            background: isOriginalActive
              ? 'radial-gradient(ellipse at top, rgba(34,211,238,0.42), transparent 70%)'
              : `radial-gradient(ellipse at top, ${
                  activePlayer?.color || '#ec4899'
                }55, transparent 70%)`,
            clipPath: 'polygon(26% 0%, 74% 0%, 100% 100%, 0% 100%)',
          }}
        />
      )}

      {/* Stage Back Screen + Pulsing Speakers */}
      <div className="relative z-10 flex items-center justify-center gap-3 px-3 pt-3">
        <motion.div
          animate={isOriginalActive ? { scale: 1 + speakerVolume * 0.16 } : { scale: 1 }}
          className={`hidden sm:flex h-14 w-11 flex-col items-center justify-around rounded-xl border p-1 transition-colors ${
            isOriginalActive
              ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_24px_rgba(34,211,238,0.45)]'
              : 'border-white/10 bg-black/40 opacity-60'
          }`}
        >
          <div className="h-3.5 w-3.5 rounded-full bg-slate-800 ring-2 ring-cyan-400/60" />
          <div className="h-5 w-5 rounded-full bg-slate-800 ring-2 ring-fuchsia-400/60" />
        </motion.div>

        <motion.div
          animate={isOriginalActive ? { scale: 1.03 + speakerVolume * 0.05 } : { scale: 1 }}
          className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-1.5 transition-all max-w-full ${
            isOriginalActive
              ? 'border-cyan-300 bg-gradient-to-r from-cyan-500/25 via-fuchsia-500/20 to-amber-500/25 shadow-[0_0_26px_rgba(34,211,238,0.35)]'
              : 'border-white/10 bg-black/40'
          }`}
        >
          <span className="text-lg sm:text-xl shrink-0">{meme?.emoji || '🎬'}</span>
          <div className="text-left min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
              {isOriginalActive && <Volume2 className="h-3 w-3 animate-pulse" />}
              <span>{isOriginalActive ? 'Звучит оригинал!' : 'Мем раунда'}</span>
            </div>
            <div className="font-display font-bold text-xs sm:text-sm text-white truncate">
              {meme?.title || 'Сцена готова'}
            </div>
          </div>
        </motion.div>

        <motion.div
          animate={isOriginalActive ? { scale: 1 + speakerVolume * 0.16 } : { scale: 1 }}
          className={`hidden sm:flex h-14 w-11 flex-col items-center justify-around rounded-xl border p-1 transition-colors ${
            isOriginalActive
              ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_24px_rgba(34,211,238,0.45)]'
              : 'border-white/10 bg-black/40 opacity-60'
          }`}
        >
          <div className="h-3.5 w-3.5 rounded-full bg-slate-800 ring-2 ring-cyan-400/60" />
          <div className="h-5 w-5 rounded-full bg-slate-800 ring-2 ring-fuchsia-400/60" />
        </motion.div>
      </div>

      {/* Audience Back Row (Expressive Laugh / Cry / Surprise reactions!) */}
      <div className="relative z-10 px-2 sm:px-4 pt-3 pb-1">
        <div className="grid grid-cols-5 sm:flex sm:flex-wrap items-end justify-items-center sm:justify-center gap-1.5 sm:gap-4">
          {backRowPlayers.map((p, idx) => {
            const isDimmed = isOriginalActive;
            const isMe = p.id === myPlayerId;
            const explicitMood = reactionMoodByPlayer[p.id];

            // Spontaneous lively audience reaction on vocal peaks when a performer is on stage
            let autoMood: AudienceMood = 'idle';
            if (activePlayer && speakerVolume > 0.42) {
              const cycle: AudienceMood[] = ['laugh', 'surprised', 'cheer', 'cry'];
              autoMood = cycle[idx % cycle.length];
            }

            const finalMood: AudienceMood = explicitMood?.mood || autoMood;

            return (
              <motion.div
                layout
                key={p.id}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="relative flex flex-col items-center w-full sm:w-auto"
              >
                {/* Reaction bubble above audience character */}
                <AnimatePresence>
                  {explicitMood && (
                    <motion.div
                      initial={{ scale: 0, y: 6 }}
                      animate={{ scale: 1, y: -4 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -top-3 z-30 rounded-full bg-white/95 px-1.5 py-0.5 text-xs sm:text-sm shadow-lg"
                    >
                      {explicitMood.emoji}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="sm:hidden">
                  <CharacterAvatar
                    characterId={p.characterId}
                    size={activePlayer ? 46 : 54}
                    dimmed={isDimmed}
                    idle={p.connected}
                    mood={finalMood}
                  />
                </div>
                <div className="hidden sm:block">
                  <CharacterAvatar
                    characterId={p.characterId}
                    size={activePlayer ? 62 : 76}
                    dimmed={isDimmed}
                    idle={p.connected}
                    mood={finalMood}
                  />
                </div>
                <div
                  className={`mt-0.5 flex items-center gap-0.5 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[11px] font-bold backdrop-blur max-w-full ${
                    isMe
                      ? 'bg-fuchsia-500/40 border border-fuchsia-300/50 text-white'
                      : 'bg-black/50 text-white/85'
                  }`}
                >
                  {p.isHost && <Crown className="h-2.5 w-2.5 text-amber-300 shrink-0" />}
                  <span className="truncate max-w-[54px] sm:max-w-[82px]">{p.nickname}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Close-up Center Foreground Performer ("крупным планом рассказывает") */}
      <AnimatePresence mode="wait">
        {activePlayer && (
          <motion.div
            layout
            key={activePlayer.id}
            initial={{ y: 34, scale: 0.72, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.72, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
            className="relative z-20 flex flex-col items-center pb-4 pt-2"
          >
            {/* Floating music & voice particles when speaking */}
            {speakerVolume > 0.25 && (
              <div className="pointer-events-none absolute -top-1 flex gap-10 text-xl">
                <motion.span
                  animate={{ y: [-2, -26], opacity: [0.95, 0], rotate: [-10, 12] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                >
                  🎵
                </motion.span>
                <motion.span
                  animate={{ y: [-2, -28], opacity: [0.95, 0], rotate: [10, -12] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: 0.25 }}
                >
                  💬
                </motion.span>
              </div>
            )}

            <div
              className="relative rounded-full p-2 transition-shadow"
              style={{
                boxShadow: `0 0 ${26 + speakerVolume * 52}px ${activePlayer.color}99`,
              }}
            >
              <div className="sm:hidden">
                <CharacterAvatar
                  characterId={activePlayer.characterId}
                  size={136}
                  mouthOpen={speakerVolume}
                  isSpeaking
                />
              </div>
              <div className="hidden sm:block">
                <CharacterAvatar
                  characterId={activePlayer.characterId}
                  size={164}
                  mouthOpen={speakerVolume}
                  isSpeaking
                />
              </div>

              {/* Stage stand mic in front of performer */}
              <div className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/90 border border-white/30 text-amber-300 shadow-lg">
                <Mic className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white text-slate-950 px-4 py-1 font-display font-black text-sm sm:text-base shadow-xl">
              <span>{activePlayer.nickname}</span>
              <span className="text-[10px] font-extrabold uppercase text-fuchsia-600">НА СЦЕНЕ</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Equalizer Stage Rim */}
      <div className="relative h-4 w-full bg-gradient-to-r from-fuchsia-500/35 via-cyan-400/55 to-amber-400/35 border-t border-white/25 flex items-end justify-around px-3 overflow-hidden">
        {Array.from({ length: 16 }).map((_, idx) => (
          <motion.div
            key={idx}
            animate={{
              height: hasSpotlight
                ? `${Math.max(20, Math.min(100, 25 + speakerVolume * 80 * ((idx % 3) + 1) * 0.4))}%`
                : '25%',
            }}
            transition={{ duration: 0.08 }}
            className="w-2 sm:w-3 rounded-t-sm bg-white/45"
          />
        ))}
      </div>
    </motion.div>
  );
};
