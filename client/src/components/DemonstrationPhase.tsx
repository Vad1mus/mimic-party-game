import React from 'react';
import { Eye, Lightbulb } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { MemePlayer } from './MemePlayer';
import { PhaseCountdown } from './PhaseCountdown';
import { ConcertStage } from './ConcertStage';

interface DemonstrationPhaseProps {
  room: RoomState;
  me: Player;
}

export const DemonstrationPhase: React.FC<DemonstrationPhaseProps> = ({ room, me }) => {
  const meme = room.selectedMeme;
  if (!meme) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
      <div className="party-card rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Раунд {room.currentRound}/{room.settings.totalRounds} • Слушаем оригинал
            </span>
          </div>
          <h2 className="font-display text-lg sm:text-2xl font-black text-white truncate">
            Запомни ритм и интонацию!
          </h2>
        </div>
        <PhaseCountdown phaseEndsAt={room.phaseEndsAt} />
      </div>

      <ConcertStage players={room.players} isOriginalActive meme={meme} myPlayerId={me.id} />

      <div className="party-card rounded-3xl p-3.5 sm:p-5 space-y-3">
        <MemePlayer meme={meme} autoPlay compact />

        <div className="rounded-2xl bg-amber-400/15 border border-amber-400/35 px-3.5 py-2.5 flex items-center gap-2.5">
          <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 shrink-0" />
          <p className="text-xs sm:text-sm font-bold text-white/95">{meme.promptHint}</p>
        </div>

        <p className="text-center text-[11px] sm:text-xs font-semibold text-white/60">
          Сразу после прослушивания пойдёт отсчёт 3-2-1 и автоматическая запись!
        </p>
      </div>
    </div>
  );
};
