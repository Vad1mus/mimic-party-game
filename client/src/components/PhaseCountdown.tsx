import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface PhaseCountdownProps {
  phaseEndsAt: number | null;
  totalSec?: number | null;
  urgentBelow?: number;
}

export const PhaseCountdown: React.FC<PhaseCountdownProps> = ({
  phaseEndsAt,
  urgentBelow = 5,
}) => {
  const [remaining, setRemaining] = useState<number>(() =>
    phaseEndsAt ? Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!phaseEndsAt) {
      setRemaining(0);
      return;
    }
    const update = () => {
      setRemaining(Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)));
    };
    update();
    const id = window.setInterval(update, 200);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  if (!phaseEndsAt) return null;

  const isUrgent = remaining <= urgentBelow;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display font-bold text-sm sm:text-base border transition-colors ${
        isUrgent
          ? 'bg-rose-500/25 border-rose-400 text-rose-200 animate-pulse'
          : 'bg-white/10 border-white/20 text-cyan-200'
      }`}
    >
      <Clock className="h-4 w-4" />
      <span>{remaining} сек</span>
    </div>
  );
};
