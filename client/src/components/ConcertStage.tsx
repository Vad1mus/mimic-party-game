import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Volume2 } from 'lucide-react';
import { MemeItem, Player } from '../types/game';
import { CharacterAvatar } from './CharacterAvatar';

interface ConcertStageProps {
  players: Player[];
  activePlayerId?: string | null;
  isOriginalActive?: boolean;
  speakerVolume?: number; // 0..1 real-time AnalyserNode value
  meme?: MemeItem | null;
  myPlayerId?: string;
}

export const ConcertStage: React.FC<ConcertStageProps> = ({
  players,
  activePlayerId = null,
  isOriginalActive = false,
  speakerVolume = 0,
  meme = null,
  myPlayerId,
}) => {
  const hasSpotlight = Boolean(activePlayerId) || isOriginalActive;
  const activePlayer = players.find((p) => p.id === activePlayerId) || null;
  const backRowPlayers = activePlayer
    ? players.filter((p) => p.id !== activePlayer.id)
    : players;

  // Screen shake when someone screams loudly into mic/recording
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
      <div className="relative h-6 w-full border-b border-white/10 bg-black/45 flex items-center justify-around px-6">
        {['#ec4899', '#22d3ee', '#f59e0b', '#a855f7', '#10b981'].map((col, i) => (
          <div
            key={i}
            className="h-2.5 w-6 rounded-b-full transition-opacity"
            style={{
              backgroundColor: col,
              boxShadow: `0 4px 18px ${col}`,
              opacity: hasSpotlight ? 0.95 : 0.55,
            }}
          />
        ))}
      </div>

      {/* Main Spotlight Cone */}
      {hasSpotlight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 + speakerVolume * 0.25 }}
          className="pointer-events-none absolute inset-x-0 top-5 mx-auto h-72 w-72 sm:w-96"
          style={{
            background: isOriginalActive
              ? 'radial-gradient(ellipse at top, rgba(34,211,238,0.42), transparent 70%)'
              : `radial-gradient(ellipse at top, ${
                  activePlayer?.color || '#ec4899'
                }55, transparent 70%)`,
            clipPath: 'polygon(28% 0%, 72% 0%, 100% 100%, 0% 100%)',
          }}
        />
      )}

      {/* Stage Back Screen + Speakers (highlights during Original) */}
      <div className="relative z-10 flex items-center justify-center gap-4 px-4 pt-4">
        <motion.div
          animate={
            isOriginalActive
              ? { scale: 1 + speakerVolume * 0.14 }
              : { scale: 1 }
          }
          className={`hidden sm:flex h-16 w-12 flex-col items-center justify-around rounded-xl border p-1.5 transition-colors ${
            isOriginalActive
              ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_24px_rgba(34,211,238,0.4)]'
              : 'border-white/10 bg-black/40 opacity-60'
          }`}
        >
          <div className="h-4 w-4 rounded-full bg-slate-800 ring-2 ring-cyan-400/50" />
          <div className="h-6 w-6 rounded-full bg-slate-800 ring-2 ring-fuchsia-400/50" />
        </motion.div>

        <motion.div
          animate={
            isOriginalActive
              ? { scale: 1.04 + speakerVolume * 0.04 }
              : { scale: 1 }
          }
          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 transition-all ${
            isOriginalActive
              ? 'border-cyan-300 bg-gradient-to-r from-cyan-500/25 via-fuchsia-500/20 to-amber-500/25 shadow-[0_0_30px_rgba(34,211,238,0.35)]'
              : 'border-white/10 bg-black/35'
          }`}
        >
          <span className="text-2xl sm:text-3xl">{meme?.emoji || '🎬'}</span>
          <div className="text-left">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
              {isOriginalActive && <Volume2 className="h-3 w-3 animate-pulse" />}
              <span>{isOriginalActive ? 'Звучит оригинал!' : 'Мем раунда'}</span>
            </div>
            <div className="font-display font-bold text-sm sm:text-base text-white">
              {meme?.title || 'Сцена готова'}
            </div>
          </div>
        </motion.div>

        <motion.div
          animate={
            isOriginalActive
              ? { scale: 1 + speakerVolume * 0.14 }
              : { scale: 1 }
          }
          className={`hidden sm:flex h-16 w-12 flex-col items-center justify-around rounded-xl border p-1.5 transition-colors ${
            isOriginalActive
              ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_24px_rgba(34,211,238,0.4)]'
              : 'border-white/10 bg-black/40 opacity-60'
          }`}
        >
          <div className="h-4 w-4 rounded-full bg-slate-800 ring-2 ring-cyan-400/50" />
          <div className="h-6 w-6 rounded-full bg-slate-800 ring-2 ring-fuchsia-400/50" />
        </motion.div>
      </div>

      {/* Back Row / Full Lineup */}
      <div className="relative z-10 px-3 pt-4 pb-3">
        <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-4">
          {backRowPlayers.map((p) => {
            const isDimmed = Boolean(activePlayer) || isOriginalActive;
            const isMe = p.id === myPlayerId;
            return (
              <motion.div
                layout
                key={p.id}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="flex flex-col items-center"
              >
                <CharacterAvatar
                  characterId={p.characterId}
                  size={isDimmed ? 56 : 72}
                  dimmed={isDimmed}
                  idle={p.connected}
                />
                <div
                  className={`mt-1 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold backdrop-blur ${
                    isMe
                      ? 'bg-fuchsia-500/35 border border-fuchsia-300/50 text-white'
                      : 'bg-black/45 text-white/80'
                  } ${isDimmed ? 'opacity-50' : ''}`}
                >
                  {p.isHost && <Crown className="h-2.5 w-2.5 text-amber-300" />}
                  <span className="max-w-[74px] truncate">{p.nickname}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Center Foreground Spotlight Performer */}
      {activePlayer && (
        <motion.div
          layout
          key={activePlayer.id}
          initial={{ y: 30, scale: 0.7, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 20, scale: 0.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative z-20 flex flex-col items-center pb-5 pt-1"
        >
          <div
            className="rounded-full p-2 transition-shadow"
            style={{
              boxShadow: `0 0 ${26 + speakerVolume * 45}px ${activePlayer.color}88`,
            }}
          >
            <CharacterAvatar
              characterId={activePlayer.characterId}
              size={128}
              mouthOpen={speakerVolume}
              isSpeaking
            />
          </div>
          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-white text-slate-950 px-4 py-1 font-display font-black text-sm sm:text-base shadow-xl">
            <span>{activePlayer.nickname}</span>
            <span className="text-xs font-extrabold uppercase text-fuchsia-600">В ЭФИРЕ</span>
          </div>
        </motion.div>
      )}

      {/* Stage Floor Rim */}
      <div className="h-4 w-full bg-gradient-to-r from-fuchsia-500/30 via-cyan-400/50 to-amber-400/30 border-t border-white/25" />
    </motion.div>
  );
};
