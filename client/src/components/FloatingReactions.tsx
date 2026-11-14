import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReactionEvent } from '../types/game';

interface FloatingReactionsProps {
  reactions: ReactionEvent[];
}

export const FloatingReactions: React.FC<FloatingReactionsProps> = ({ reactions }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => {
          let hash = 0;
          for (let i = 0; i < r.id.length; i++) {
            hash = (hash * 31 + r.id.charCodeAt(i)) % 1000;
          }
          const leftPct = 10 + (hash % 80);

          return (
            <motion.div
              key={r.id}
              initial={{ y: 20, opacity: 0, scale: 0.4, rotate: -12 }}
              animate={{ y: -340, opacity: [0, 1, 1, 0], scale: [0.5, 1.25, 1], rotate: [0, 8, -8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: 'easeOut' }}
              className="absolute bottom-14 flex flex-col items-center"
              style={{ left: `${leftPct}%` }}
            >
              <span className="text-4xl sm:text-5xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]">
                {r.emoji}
              </span>
              <span className="mt-1 rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-bold text-white/95 backdrop-blur">
                {r.fromNickname}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
