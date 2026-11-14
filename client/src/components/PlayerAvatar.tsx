import React from 'react';
import { Crown, Check, WifiOff } from 'lucide-react';
import { Player } from '../types/game';
import { CharacterAvatar } from './CharacterAvatar';

interface PlayerAvatarProps {
  player: Pick<Player, 'characterId' | 'color' | 'nickname' | 'isHost' | 'isReady' | 'connected'>;
  size?: number;
  showBadge?: boolean;
  highlight?: boolean;
  mouthOpen?: number;
  isSpeaking?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  size = 56,
  showBadge = true,
  highlight = false,
  mouthOpen = 0,
  isSpeaking = false,
}) => {
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <div
        className={`rounded-2xl p-1 transition-all ${
          highlight ? 'ring-2 ring-amber-400 bg-white/10' : 'bg-white/5'
        } ${!player.connected ? 'opacity-45 grayscale' : ''}`}
      >
        <CharacterAvatar
          characterId={player.characterId}
          size={size}
          mouthOpen={mouthOpen}
          isSpeaking={isSpeaking}
          idle={player.connected}
        />
      </div>

      {showBadge && player.isHost && (
        <span
          title="Хост комнаты"
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-md ring-2 ring-[#170d38]"
        >
          <Crown className="h-3 w-3 fill-current" />
        </span>
      )}

      {showBadge && !player.connected && (
        <span
          title="Переподключение..."
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow ring-2 ring-[#170d38]"
        >
          <WifiOff className="h-3 w-3" />
        </span>
      )}

      {showBadge && player.connected && !player.isHost && player.isReady && (
        <span
          title="Готов"
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow ring-2 ring-[#170d38]"
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}
    </div>
  );
};
