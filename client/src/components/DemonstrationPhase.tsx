import React, { useEffect } from 'react';
import { Eye, Lightbulb, ArrowRight } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { MemePlayer } from './MemePlayer';
import { PhaseCountdown } from './PhaseCountdown';
import { ConcertStage } from './ConcertStage';

interface DemonstrationPhaseProps {
  room: RoomState;
  me: Player;
  onAdvanceFromDemo: () => void;
}

export const DemonstrationPhase: React.FC<DemonstrationPhaseProps> = ({
  room,
  me,
  onAdvanceFromDemo,
}) => {
  const meme = room.selectedMeme;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!meme) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 space-y-4">
      <div className="party-card rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-cyan-300">
            <Eye className="h-4 w-4" />
            <span>Раунд {room.currentRound}/{room.settings.totalRounds} • Демонстрация</span>
          </div>
          <h2 className="font-display text-2xl font-black text-white">
            Запомни ритм, громкость и интонацию!
          </h2>
        </div>
        <PhaseCountdown phaseEndsAt={room.phaseEndsAt} />
      </div>

      <ConcertStage
        players={room.players}
        isOriginalActive
        meme={meme}
        myPlayerId={me.id}
      />

      <div className="party-card rounded-3xl p-4 sm:p-5 space-y-4">
        <MemePlayer meme={meme} autoPlay />

        <div className="rounded-2xl bg-amber-400/15 border border-amber-400/35 px-4 py-3 flex items-center gap-3">
          <Lightbulb className="h-5 w-5 text-amber-300 shrink-0" />
          <p className="text-sm font-bold text-white/95">{meme.promptHint}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-semibold text-white/65">
            Во время записи ты увидишь волну оригинала и сможешь попадать прямо в неё!
          </p>
          {me.isHost && (
            <button
              type="button"
              onClick={onAdvanceFromDemo}
              className="party-btn-primary w-full sm:w-auto"
            >
              <span>К записи!</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
