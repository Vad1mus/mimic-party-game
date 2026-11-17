import React from 'react';
import { Lock, Check } from 'lucide-react';
import { CHARACTER_LIST, CharacterId, Player } from '../types/game';
import { CharacterAvatar } from './CharacterAvatar';
import { soundFx } from '../utils/soundFx';

interface CharacterPickerProps {
  selectedId: CharacterId;
  onSelect: (id: CharacterId) => void;
  players?: Player[];
  myPlayerId?: string;
}

export const CharacterPicker: React.FC<CharacterPickerProps> = ({
  selectedId,
  onSelect,
  players = [],
  myPlayerId,
}) => {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {CHARACTER_LIST.map((char) => {
        const owner = players.find((p) => p.characterId === char.id);
        const isTakenByOther = Boolean(owner && owner.id !== myPlayerId);
        const isMine = selectedId === char.id;

        return (
          <button
            key={char.id}
            type="button"
            disabled={isTakenByOther}
            onClick={() => {
              soundFx.pop();
              onSelect(char.id);
            }}
            className={`relative flex flex-col items-center justify-center rounded-2xl p-2 border transition-all ${
              isMine
                ? 'bg-gradient-to-b from-fuchsia-500/35 to-amber-500/20 border-amber-300 ring-2 ring-amber-300/60 scale-[1.03]'
                : isTakenByOther
                ? 'bg-black/40 border-white/5 opacity-45 cursor-not-allowed'
                : 'bg-white/5 border-white/15 hover:bg-white/15 active:scale-95'
            }`}
          >
            <CharacterAvatar
              characterId={char.id}
              size={44}
              idle={isMine}
              dimmed={isTakenByOther}
            />
            <span className="mt-1 text-[10px] font-extrabold text-white/90 truncate max-w-full">
              {char.name}
            </span>

            {isMine && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}

            {isTakenByOther && owner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/55 px-1 text-center backdrop-blur-[1px]">
                <Lock className="h-3.5 w-3.5 text-rose-300 mb-0.5" />
                <span className="text-[9px] font-extrabold uppercase text-rose-200 leading-tight">
                  Занято
                </span>
                <span className="text-[9px] font-bold text-white/80 truncate max-w-full">
                  {owner.nickname}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
