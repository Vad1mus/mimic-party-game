import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { GamePhase, RoomState } from '../types/game';
import { useMediaStream } from './MediaStreamContext';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Voice chat is active ONLY in Lobby, Round Results, and Game Over Podium.
// Automatically muted during Demonstration, Recording, and Gallery so voices never leak or interrupt!
const VOICE_CHAT_PHASES = new Set<GamePhase>(['lobby', 'round_results', 'game_over']);

interface WebRtcVoiceContextValue {
  isSelfMuted: boolean;
  toggleSelfMute: () => void;
  isVoicePhaseActive: boolean;
  connectedPeerIds: string[];
}

const WebRtcVoiceContext = createContext<WebRtcVoiceContextValue>({
  isSelfMuted: false,
  toggleSelfMute: () => {},
  isVoicePhaseActive: true,
  connectedPeerIds: [],
});

interface WebRtcVoiceProviderProps {
  socket: Socket | null;
  room: RoomState | null;
  myPlayerId: string;
  children: React.ReactNode;
}

export const WebRtcVoiceProvider: React.FC<WebRtcVoiceProviderProps> = ({
  socket,
  room,
  myPlayerId,
  children,
}) => {
  const { micStream } = useMediaStream();
  const [isSelfMuted, setIsSelfMuted] = useState(false);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rtcTrackRef = useRef<MediaStreamTrack | null>(null);
  const rtcStreamRef = useRef<MediaStream | null>(null);

  const isVoicePhaseActive = room ? VOICE_CHAT_PHASES.has(room.phase) : false;
  const shouldTransmit = Boolean(micStream) && isVoicePhaseActive && !isSelfMuted;
  const shouldHearPeers = isVoicePhaseActive;

  // Keep a dedicated cloned track for WebRTC so muting WebRTC NEVER mutes MediaRecorder!
  useEffect(() => {
    if (!micStream) {
      if (rtcTrackRef.current) {
        rtcTrackRef.current.stop();
        rtcTrackRef.current = null;
      }
      rtcStreamRef.current = null;
      return;
    }

    const baseTrack = micStream.getAudioTracks()[0];
    if (!baseTrack) return;

    if (!rtcTrackRef.current || rtcTrackRef.current.readyState === 'ended') {
      const cloned = baseTrack.clone();
      cloned.enabled = shouldTransmit;
      rtcTrackRef.current = cloned;
      rtcStreamRef.current = new MediaStream([cloned]);

      // Attach track to any already-open peer connections & renegotiate if needed
      peersRef.current.forEach(async (pc, remoteId) => {
        const senders = pc.getSenders();
        if (senders.length === 0 && rtcStreamRef.current) {
          pc.addTrack(cloned, rtcStreamRef.current);
          if (socket && pc.signalingState === 'stable') {
            try {
              const offer = await pc.createOffer({ offerToReceiveAudio: true });
              await pc.setLocalDescription(offer);
              socket.emit('webrtc_offer', { targetPlayerId: remoteId, sdp: pc.localDescription });
            } catch {
              // ignore
            }
          }
        }
      });
    }
  }, [micStream, shouldTransmit, socket]);

  // Apply phase-based auto-mute + manual mute instantaneously
  useEffect(() => {
    if (rtcTrackRef.current) {
      rtcTrackRef.current.enabled = shouldTransmit;
    }
    remoteAudioRef.current.forEach((audioEl) => {
      audioEl.muted = !shouldHearPeers;
    });
  }, [shouldTransmit, shouldHearPeers]);

  const closePeer = useCallback((remoteId: string) => {
    const pc = peersRef.current.get(remoteId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(remoteId);
    }
    const audioEl = remoteAudioRef.current.get(remoteId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      remoteAudioRef.current.delete(remoteId);
    }
    setConnectedPeerIds(Array.from(peersRef.current.keys()));
  }, []);

  const createPeerConnection = useCallback(
    (remoteId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_CONFIG);
      peersRef.current.set(remoteId, pc);

      if (rtcTrackRef.current && rtcStreamRef.current) {
        pc.addTrack(rtcTrackRef.current, rtcStreamRef.current);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit('webrtc_ice_candidate', {
            targetPlayerId: remoteId,
            candidate: e.candidate,
          });
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!stream) return;
        let audioEl = remoteAudioRef.current.get(remoteId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          remoteAudioRef.current.set(remoteId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.muted = !shouldHearPeers;
        audioEl.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(remoteId);
        } else {
          setConnectedPeerIds(Array.from(peersRef.current.keys()));
        }
      };

      setConnectedPeerIds(Array.from(peersRef.current.keys()));
      return pc;
    },
    [socket, closePeer, shouldHearPeers]
  );

  // Sync Mesh peers with current connected room players
  useEffect(() => {
    if (!room || !socket || !myPlayerId) {
      Array.from(peersRef.current.keys()).forEach(closePeer);
      return;
    }

    const activePeers = room.players.filter((p) => p.connected && p.id !== myPlayerId);
    const activeIds = new Set(activePeers.map((p) => p.id));

    // Close departed peers
    Array.from(peersRef.current.keys()).forEach((id) => {
      if (!activeIds.has(id)) closePeer(id);
    });

    // Initiate offers deterministically (lexicographically smaller ID initiates)
    activePeers.forEach(async (peer) => {
      if (!peersRef.current.has(peer.id) && myPlayerId < peer.id) {
        const pc = createPeerConnection(peer.id);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetPlayerId: peer.id,
            sdp: pc.localDescription,
          });
        } catch {
          // ignore transient negotiation errors
        }
      }
    });
  }, [room?.players, room?.code, socket, myPlayerId, createPeerConnection, closePeer]);

  // Handle incoming Socket.io WebRTC signaling
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({
      fromPlayerId,
      sdp,
    }: {
      fromPlayerId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      try {
        const pc = createPeerConnection(fromPlayerId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', {
          targetPlayerId: fromPlayerId,
          sdp: pc.localDescription,
        });
      } catch {
        // ignore
      }
    };

    const handleAnswer = async ({
      fromPlayerId,
      sdp,
    }: {
      fromPlayerId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = peersRef.current.get(fromPlayerId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch {
        // ignore
      }
    };

    const handleIce = async ({
      fromPlayerId,
      candidate,
    }: {
      fromPlayerId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peersRef.current.get(fromPlayerId);
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    };

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIce);

    return () => {
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIce);
    };
  }, [socket, createPeerConnection]);

  useEffect(() => {
    return () => {
      Array.from(peersRef.current.keys()).forEach(closePeer);
      if (rtcTrackRef.current) {
        rtcTrackRef.current.stop();
        rtcTrackRef.current = null;
      }
    };
  }, [closePeer]);

  const toggleSelfMute = useCallback(() => {
    setIsSelfMuted((m) => !m);
  }, []);

  return (
    <WebRtcVoiceContext.Provider
      value={{
        isSelfMuted,
        toggleSelfMute,
        isVoicePhaseActive,
        connectedPeerIds,
      }}
    >
      {children}
    </WebRtcVoiceContext.Provider>
  );
};

export function useWebRtcVoice() {
  return useContext(WebRtcVoiceContext);
}
