import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MemeItem,
  ReactionEvent,
  RoomSettings,
  RoomState,
  VoiceAnalysisMetrics,
} from '../types/game';
import { SERVER_URL } from '../utils/serverUrl';

const STORAGE_PLAYER_ID = 'mimic_player_id';
const STORAGE_ROOM_CODE = 'mimic_room_code';
const STORAGE_NICKNAME = 'mimic_nickname';

function getStoredPlayerId(): string {
  let id = sessionStorage.getItem(STORAGE_PLAYER_ID);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(STORAGE_PLAYER_ID, id);
  }
  return id;
}

export interface LocalRecordingMedia {
  url: string;
  blob: Blob;
  mimeType: string;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>(() => getStoredPlayerId());
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [recordingMedia, setRecordingMedia] = useState<Record<string, LocalRecordingMedia>>({});
  const mediaRef = useRef<Record<string, LocalRecordingMedia>>({});

  const clearLocalMedia = useCallback(() => {
    Object.values(mediaRef.current).forEach((m) => {
      URL.revokeObjectURL(m.url);
    });
    mediaRef.current = {};
    setRecordingMedia({});
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL || undefined, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 12,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const savedCode = sessionStorage.getItem(STORAGE_ROOM_CODE);
      const savedNick = sessionStorage.getItem(STORAGE_NICKNAME);
      const pid = getStoredPlayerId();
      if (savedCode && savedNick) {
        socket.emit(
          'join_room',
          { code: savedCode, playerId: pid, nickname: savedNick },
          (res: { ok: boolean; room?: RoomState; playerId?: string }) => {
            if (res?.ok && res.room) {
              setRoom(res.room);
              if (res.playerId) setPlayerId(res.playerId);
            } else {
              sessionStorage.removeItem(STORAGE_ROOM_CODE);
            }
          }
        );
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room_state', (nextRoom: RoomState) => {
      setRoom(nextRoom);
    });

    socket.on(
      'recording_audio_data',
      (payload: { playerId: string; mimeType: string; buffer: ArrayBuffer | Uint8Array }) => {
        if (!payload?.playerId || !payload?.buffer) return;
        const arrayBuf =
          payload.buffer instanceof ArrayBuffer
            ? payload.buffer
            : new Uint8Array(payload.buffer).slice().buffer;
        const blob = new Blob([arrayBuf], {
          type: payload.mimeType || 'audio/webm;codecs=opus',
        });
        const url = URL.createObjectURL(blob);
        const prev = mediaRef.current[payload.playerId];
        if (prev) URL.revokeObjectURL(prev.url);
        const entry: LocalRecordingMedia = {
          url,
          blob,
          mimeType: payload.mimeType || 'audio/webm;codecs=opus',
        };
        mediaRef.current = { ...mediaRef.current, [payload.playerId]: entry };
        setRecordingMedia(mediaRef.current);
      }
    );

    socket.on('clear_round_audio', () => {
      clearLocalMedia();
    });

    socket.on('reaction_burst', (evt: ReactionEvent) => {
      setReactions((prev) => [...prev.slice(-28), evt]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== evt.id));
      }, 2700);
    });

    return () => {
      clearLocalMedia();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clearLocalMedia]);

  const clearError = useCallback(() => setError(null), []);

  const createRoom = useCallback(
    (nickname: string): Promise<boolean> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) {
          setError('Нет соединения с сервером.');
          resolve(false);
          return;
        }
        const pid = getStoredPlayerId();
        socket.emit(
          'create_room',
          { playerId: pid, nickname },
          (res: { ok: boolean; room?: RoomState; playerId?: string; error?: string }) => {
            if (res?.ok && res.room) {
              sessionStorage.setItem(STORAGE_ROOM_CODE, res.room.code);
              sessionStorage.setItem(STORAGE_NICKNAME, nickname);
              setPlayerId(res.playerId || pid);
              setRoom(res.room);
              setError(null);
              resolve(true);
            } else {
              setError(res?.error || 'Не удалось создать комнату.');
              resolve(false);
            }
          }
        );
      }),
    []
  );

  const joinRoom = useCallback(
    (code: string, nickname: string): Promise<boolean> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) {
          setError('Нет соединения с сервером.');
          resolve(false);
          return;
        }
        const pid = getStoredPlayerId();
        socket.emit(
          'join_room',
          { code, playerId: pid, nickname },
          (res: { ok: boolean; room?: RoomState; playerId?: string; error?: string }) => {
            if (res?.ok && res.room) {
              sessionStorage.setItem(STORAGE_ROOM_CODE, res.room.code);
              sessionStorage.setItem(STORAGE_NICKNAME, nickname);
              setPlayerId(res.playerId || pid);
              setRoom(res.room);
              setError(null);
              resolve(true);
            } else {
              setError(res?.error || 'Не удалось войти в комнату.');
              resolve(false);
            }
          }
        );
      }),
    []
  );

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave_room');
    sessionStorage.removeItem(STORAGE_ROOM_CODE);
    clearLocalMedia();
    setRoom(null);
  }, [clearLocalMedia]);

  const toggleReady = useCallback(() => socketRef.current?.emit('toggle_ready'), []);

  const updateSettings = useCallback(
    (partial: Partial<RoomSettings>) => socketRef.current?.emit('update_settings', partial),
    []
  );

  const startGame = useCallback(() => socketRef.current?.emit('start_game'), []);

  const addCustomMeme = useCallback(
    (payload: {
      title: string;
      promptHint?: string;
      emoji?: string;
      type: 'audio' | 'video';
      mimeType: string;
      duration: number;
      buffer: ArrayBuffer;
    }): Promise<{ ok: boolean; meme?: MemeItem; error?: string }> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) {
          resolve({ ok: false, error: 'Нет соединения с сервером.' });
          return;
        }
        socket.emit('add_custom_meme', payload, (res: { ok: boolean; meme?: MemeItem; error?: string }) => {
          resolve(res || { ok: false, error: 'Ошибка сервера.' });
        });
      }),
    []
  );

  const removeCustomMeme = useCallback(
    (memeId: string) => socketRef.current?.emit('remove_custom_meme', { memeId }),
    []
  );

  const selectMeme = useCallback(
    (memeId: string) => socketRef.current?.emit('select_meme', { memeId }),
    []
  );

  const advanceFromDemo = useCallback(() => socketRef.current?.emit('advance_from_demo'), []);

  const submitRecording = useCallback(
    (payload: {
      buffer: ArrayBuffer;
      mimeType: string;
      duration: number;
      analysis: VoiceAnalysisMetrics;
    }): Promise<boolean> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) {
          resolve(false);
          return;
        }
        socket.emit('submit_recording', payload, (res: { ok: boolean }) => {
          resolve(Boolean(res?.ok));
        });
      }),
    []
  );

  const skipRecording = useCallback(() => socketRef.current?.emit('skip_recording'), []);

  const forceFinishRecording = useCallback(
    () => socketRef.current?.emit('force_finish_recording'),
    []
  );

  const galleryNavigate = useCallback(
    (action: 'next' | 'prev' | 'replay' | 'ended') =>
      socketRef.current?.emit('gallery_navigate', { action }),
    []
  );

  const sendReaction = useCallback(
    (emoji: string, targetPlayerId: string | null) =>
      socketRef.current?.emit('send_reaction', { emoji, targetPlayerId }),
    []
  );

  const advanceToResults = useCallback(() => socketRef.current?.emit('advance_to_results'), []);

  const nextRound = useCallback(() => socketRef.current?.emit('next_round'), []);

  const playAgain = useCallback(() => socketRef.current?.emit('play_again'), []);

  const me = room?.players.find((p) => p.id === playerId) || null;

  return {
    connected,
    room,
    me,
    playerId,
    error,
    clearError,
    reactions,
    recordingMedia,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    updateSettings,
    startGame,
    addCustomMeme,
    removeCustomMeme,
    selectMeme,
    advanceFromDemo,
    submitRecording,
    skipRecording,
    forceFinishRecording,
    galleryNavigate,
    sendReaction,
    advanceToResults,
    nextRound,
    playAgain,
  };
}
