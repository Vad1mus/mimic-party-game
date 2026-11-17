import React from 'react';
import { Mic, MicOff, Radio } from 'lucide-react';
import { useMediaStream } from '../contexts/MediaStreamContext';
import { useWebRtcVoice } from '../contexts/WebRtcVoiceContext';

export const VoiceChatBar: React.FC = () => {
  const { micStatus, micLevel, requestMicrophone } = useMediaStream();
  const { isSelfMuted, toggleSelfMute, isVoicePhaseActive, connectedPeerIds } = useWebRtcVoice();

  if (micStatus !== 'granted') {
    return (
      <button
        type="button"
        onClick={() => requestMicrophone()}
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-400/50 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/30 transition"
      >
        <MicOff className="h-3.5 w-3.5" />
        <span className="hidden xs:inline">Вкл. мик</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleSelfMute}
        title={isSelfMuted ? 'Включить голос в чате' : 'Отключить голос в чате'}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
          !isVoicePhaseActive
            ? 'bg-slate-800/80 border-white/15 text-white/55'
            : isSelfMuted
            ? 'bg-rose-500/25 border-rose-400/50 text-rose-200'
            : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
        }`}
      >
        {isSelfMuted || !isVoicePhaseActive ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {!isVoicePhaseActive
            ? 'Чат на паузе'
            : isSelfMuted
            ? 'Вы замьючены'
            : `Чат (${connectedPeerIds.length + 1})`}
        </span>
        {isVoicePhaseActive && !isSelfMuted && (
          <span
            className="h-2 w-2 rounded-full bg-emerald-400 transition-transform"
            style={{ transform: `scale(${1 + micLevel * 0.9})` }}
          />
        )}
      </button>

      {isVoicePhaseActive && connectedPeerIds.length > 0 && (
        <span
          title="WebRTC голосовой чат активен"
          className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300"
        >
          <Radio className="h-3 w-3 animate-pulse" />
        </span>
      )}
    </div>
  );
};
