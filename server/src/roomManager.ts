import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { BUILT_IN_MEMES } from './memes.js';
import {
  CharacterId,
  MemeItem,
  Player,
  PlayerRecordingMeta,
  ReactionEvent,
  RecordingScore,
  RoomSettings,
  RoomState,
  VoiceAnalysisMetrics,
} from './types.js';

export const MAX_PLAYERS = 10;

export const CHARACTER_POOL: CharacterId[] = [
  'fox',
  'cat',
  'robot',
  'frog',
  'capybara',
  'alien',
  'panda',
  'cyborg',
  'owl',
  'dino',
  'bear',
  'octopus',
  'shrek',
  'ershik',
];

const CHARACTER_COLORS: Record<CharacterId, string> = {
  fox: '#f97316',
  cat: '#ec4899',
  robot: '#06b6d4',
  frog: '#84cc16',
  capybara: '#d97706',
  alien: '#10b981',
  panda: '#6366f1',
  cyborg: '#38bdf8',
  owl: '#3b82f6',
  dino: '#f43f5e',
  bear: '#f59e0b',
  octopus: '#d946ef',
  shrek: '#65a30d',
  ershik: '#22d3ee',
};

export interface RamMediaEntry {
  buffer: Buffer;
  mimeType: string;
}

interface InternalRoom {
  state: RoomState;
  phaseTimer: NodeJS.Timeout | null;
  galleryAutoTimer: NodeJS.Timeout | null;
  hostGraceTimer: NodeJS.Timeout | null;
  reactionsByTarget: Record<string, Record<string, number>>;
  recordingBuffers: Map<string, RamMediaEntry>;
  customMemeBuffers: Map<string, RamMediaEntry>;
}

function generateRoomCode(existing: Set<string>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!existing.has(code)) return code;
  }
  return `P${Date.now().toString().slice(-4)}`;
}

function pickCharacterForJoin(existingPlayers: Player[], preferred?: CharacterId): CharacterId {
  const used = new Set(existingPlayers.map((p) => p.characterId));
  if (preferred && CHARACTER_POOL.includes(preferred) && !used.has(preferred)) {
    return preferred;
  }
  const available = CHARACTER_POOL.filter((c) => !used.has(c));
  const pool = available.length > 0 ? available : CHARACTER_POOL;
  return pool[0];
}

function pickVerdict(similarity: number, skipped?: boolean, isSilent?: boolean): string {
  if (skipped) return 'Пропущено (без микрофона) 🙈';
  if (isSilent || similarity <= 5) return 'Режим ниндзя — в микрофоне тишина! 🥷';
  if (similarity >= 88) return 'Абсолютный Оскар! Один в один! 🏆';
  if (similarity >= 74) return 'Блестящая пародия! Ритм и тон пойманы! 🔥';
  if (similarity >= 58) return 'Очень годно! Отличная энергия! 👏';
  if (similarity >= 40) return 'Почти попал, но с авторским акцентом! 😂';
  if (similarity >= 20) return 'Свободная импровизация мимо ритма! 🎭';
  return 'Экспериментальный авангард! 🤪';
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();
  private socketToRoom = new Map<string, { code: string; playerId: string }>();

  constructor(private io: Server) {}

  private clearTimers(room: InternalRoom): void {
    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
      room.phaseTimer = null;
    }
    if (room.galleryAutoTimer) {
      clearTimeout(room.galleryAutoTimer);
      room.galleryAutoTimer = null;
    }
  }

  private schedulePhaseTimer(room: InternalRoom, seconds: number, callback: () => void): void {
    this.clearTimers(room);
    room.state.phaseDurationSec = seconds;
    room.state.phaseEndsAt = Date.now() + seconds * 1000;
    room.phaseTimer = setTimeout(() => {
      room.phaseTimer = null;
      callback();
    }, Math.max(200, seconds * 1000));
  }

  private emitRoom(room: InternalRoom): void {
    this.io.to(room.state.code).emit('room_state', room.state);
  }

  public getRamMeme(code: string, memeId: string): RamMediaEntry | null {
    const internal = this.rooms.get(code.toUpperCase());
    if (!internal) return null;
    return internal.customMemeBuffers.get(memeId) || null;
  }

  public getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code.toUpperCase())?.state;
  }

  public createRoom(
    socketId: string,
    payload: { playerId?: string; nickname: string; characterId?: CharacterId }
  ): { ok: true; room: RoomState; playerId: string } | { ok: false; error: string } {
    const nickname = (payload.nickname || '').trim().slice(0, 20);
    if (!nickname) return { ok: false, error: 'Введите никнейм!' };

    const code = generateRoomCode(new Set(this.rooms.keys()));
    const playerId = payload.playerId || uuidv4();
    const characterId = pickCharacterForJoin([], payload.characterId);

    const host: Player = {
      id: playerId,
      socketId,
      nickname,
      characterId,
      color: CHARACTER_COLORS[characterId],
      isHost: true,
      isReady: true,
      connected: true,
      score: 0,
      lastRoundDelta: 0,
      stats: {
        totalSimilarity: 0,
        roundsRecorded: 0,
        totalReactionsReceived: 0,
        bestSimilarity: 0,
      },
    };

    const state: RoomState = {
      code,
      phase: 'lobby',
      settings: {
        totalRounds: 3,
        recordingMode: 'parallel',
        enabledBuiltinMemeIds: BUILT_IN_MEMES.map((m) => m.id),
      },
      players: [host],
      currentRound: 0,
      selectedMeme: null,
      usedMemeIds: [],
      phaseEndsAt: null,
      phaseDurationSec: null,
      activeTurnPlayerId: null,
      turnQueue: [],
      recordings: {},
      gallery: {
        stepIndex: 0,
        items: [],
        isPlaying: false,
        playToken: 0,
      },
      scores: {},
      customMemes: [],
    };

    const internal: InternalRoom = {
      state,
      phaseTimer: null,
      galleryAutoTimer: null,
      hostGraceTimer: null,
      reactionsByTarget: {},
      recordingBuffers: new Map(),
      customMemeBuffers: new Map(),
    };

    this.rooms.set(code, internal);
    this.socketToRoom.set(socketId, { code, playerId });
    return { ok: true, room: state, playerId };
  }

  public joinRoom(
    socketId: string,
    payload: { code: string; playerId?: string; nickname: string; characterId?: CharacterId }
  ): { ok: true; room: RoomState; playerId: string } | { ok: false; error: string } {
    const code = (payload.code || '').trim().toUpperCase();
    const internal = this.rooms.get(code);
    if (!internal) {
      return { ok: false, error: `Комната «${code}» не найдена. Проверьте код!` };
    }

    const state = internal.state;
    const nickname = (payload.nickname || '').trim().slice(0, 20);
    if (!nickname) return { ok: false, error: 'Введите никнейм!' };

    if (payload.playerId) {
      const existing = state.players.find((p) => p.id === payload.playerId);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        existing.nickname = nickname || existing.nickname;
        if (existing.isHost && internal.hostGraceTimer) {
          clearTimeout(internal.hostGraceTimer);
          internal.hostGraceTimer = null;
        }
        this.socketToRoom.set(socketId, { code, playerId: existing.id });
        this.emitRoom(internal);
        this.syncRecordingsToSocket(socketId, internal);
        return { ok: true, room: state, playerId: existing.id };
      }
    }

    if (state.players.length >= MAX_PLAYERS) {
      return { ok: false, error: `Комната заполнена (максимум ${MAX_PLAYERS} игроков).` };
    }

    const characterId = pickCharacterForJoin(state.players, payload.characterId);
    const playerId = payload.playerId || uuidv4();

    const player: Player = {
      id: playerId,
      socketId,
      nickname,
      characterId,
      color: CHARACTER_COLORS[characterId],
      isHost: false,
      isReady: false,
      connected: true,
      score: 0,
      lastRoundDelta: 0,
      stats: {
        totalSimilarity: 0,
        roundsRecorded: 0,
        totalReactionsReceived: 0,
        bestSimilarity: 0,
      },
    };

    state.players.push(player);
    this.socketToRoom.set(socketId, { code, playerId });
    this.emitRoom(internal);
    this.syncRecordingsToSocket(socketId, internal);
    return { ok: true, room: state, playerId };
  }

  public selectCharacter(
    socketId: string,
    characterId: CharacterId
  ): { ok: boolean; error?: string } {
    const ctx = this.resolve(socketId);
    if (!ctx) return { ok: false, error: 'Вы не в комнате.' };
    if (ctx.internal.state.phase !== 'lobby') {
      return { ok: false, error: 'Персонажа можно менять только в лобби.' };
    }
    if (!CHARACTER_POOL.includes(characterId)) {
      return { ok: false, error: 'Неизвестный персонаж.' };
    }

    const takenByOther = ctx.internal.state.players.some(
      (p) => p.id !== ctx.player.id && p.characterId === characterId
    );
    if (takenByOther) {
      return { ok: false, error: 'Этот персонаж уже занят другим игроком!' };
    }

    ctx.player.characterId = characterId;
    ctx.player.color = CHARACTER_COLORS[characterId];
    this.emitRoom(ctx.internal);
    return { ok: true };
  }

  private syncRecordingsToSocket(socketId: string, internal: InternalRoom): void {
    if (internal.recordingBuffers.size === 0) return;
    for (const [playerId, entry] of internal.recordingBuffers.entries()) {
      this.io.to(socketId).emit('recording_audio_data', {
        playerId,
        mimeType: entry.mimeType,
        buffer: entry.buffer,
      });
    }
  }

  public getSocketSession(socketId: string) {
    return this.socketToRoom.get(socketId);
  }

  public getTargetSocketInRoom(senderSocketId: string, targetPlayerId: string): { socketId: string; fromPlayerId: string } | null {
    const ctx = this.resolve(senderSocketId);
    if (!ctx) return null;
    const target = ctx.internal.state.players.find((p) => p.id === targetPlayerId && p.connected);
    if (!target) return null;
    return { socketId: target.socketId, fromPlayerId: ctx.player.id };
  }

  public handleDisconnect(socketId: string): void {
    const info = this.socketToRoom.get(socketId);
    if (!info) return;
    this.socketToRoom.delete(socketId);

    const internal = this.rooms.get(info.code);
    if (!internal) return;
    const player = internal.state.players.find((p) => p.id === info.playerId);
    if (!player || player.socketId !== socketId) return;

    player.connected = false;
    this.emitRoom(internal);

    if (player.isHost) {
      if (internal.hostGraceTimer) clearTimeout(internal.hostGraceTimer);
      internal.hostGraceTimer = setTimeout(() => {
        internal.hostGraceTimer = null;
        if (!player.connected) {
          const nextHost = internal.state.players.find((p) => p.connected);
          if (nextHost) {
            player.isHost = false;
            nextHost.isHost = true;
            nextHost.isReady = true;
            this.emitRoom(internal);
          } else {
            this.destroyRoom(info.code);
          }
        }
      }, 10000);
    }

    const anyConnected = internal.state.players.some((p) => p.connected);
    if (!anyConnected && !internal.hostGraceTimer) {
      internal.hostGraceTimer = setTimeout(() => {
        const stillEmpty = !internal.state.players.some((p) => p.connected);
        if (stillEmpty) this.destroyRoom(info.code);
      }, 60000);
    }
  }

  public leaveRoom(socketId: string): void {
    const info = this.socketToRoom.get(socketId);
    if (!info) return;
    this.socketToRoom.delete(socketId);

    const internal = this.rooms.get(info.code);
    if (!internal) return;

    const idx = internal.state.players.findIndex((p) => p.id === info.playerId);
    if (idx === -1) return;
    const [removed] = internal.state.players.splice(idx, 1);

    if (internal.state.players.length === 0) {
      this.destroyRoom(info.code);
      return;
    }

    if (removed.isHost) {
      const next = internal.state.players.find((p) => p.connected) || internal.state.players[0];
      next.isHost = true;
      next.isReady = true;
    }

    this.emitRoom(internal);
  }

  private destroyRoom(code: string): void {
    const internal = this.rooms.get(code);
    if (!internal) return;
    this.clearTimers(internal);
    if (internal.hostGraceTimer) clearTimeout(internal.hostGraceTimer);
    internal.recordingBuffers.clear();
    internal.customMemeBuffers.clear();
    this.rooms.delete(code);
  }

  public toggleReady(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || ctx.internal.state.phase !== 'lobby') return;
    ctx.player.isReady = !ctx.player.isReady;
    this.emitRoom(ctx.internal);
  }

  public updateSettings(socketId: string, partial: Partial<RoomSettings>): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost || ctx.internal.state.phase !== 'lobby') return;

    const s = ctx.internal.state.settings;
    if (typeof partial.totalRounds === 'number') {
      s.totalRounds = Math.max(1, Math.min(10, Math.round(partial.totalRounds)));
    }
    if (partial.recordingMode === 'parallel' || partial.recordingMode === 'sequential') {
      s.recordingMode = partial.recordingMode;
    }
    if (Array.isArray(partial.enabledBuiltinMemeIds)) {
      const validIds = new Set(BUILT_IN_MEMES.map((m) => m.id));
      const filtered = partial.enabledBuiltinMemeIds.filter((id) => validIds.has(id));
      if (filtered.length > 0 || ctx.internal.state.customMemes.length > 0) {
        s.enabledBuiltinMemeIds = filtered;
      }
    }
    this.emitRoom(ctx.internal);
  }

  public togglePackMeme(socketId: string, memeId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost || ctx.internal.state.phase !== 'lobby') return;
    const s = ctx.internal.state.settings;
    const exists = s.enabledBuiltinMemeIds.includes(memeId);
    if (exists) {
      // Never allow completely empty meme pack
      const remainingBuiltin = s.enabledBuiltinMemeIds.filter((id) => id !== memeId);
      if (remainingBuiltin.length === 0 && ctx.internal.state.customMemes.length === 0) {
        return;
      }
      s.enabledBuiltinMemeIds = remainingBuiltin;
    } else if (BUILT_IN_MEMES.some((m) => m.id === memeId)) {
      s.enabledBuiltinMemeIds = [...s.enabledBuiltinMemeIds, memeId];
    }
    this.emitRoom(ctx.internal);
  }

  public addCustomMemeInRam(
    socketId: string,
    payload: {
      title: string;
      promptHint?: string;
      emoji?: string;
      type: 'audio' | 'video';
      mimeType: string;
      duration: number;
      buffer: Buffer;
    }
  ): { ok: true; meme: MemeItem } | { ok: false; error: string } {
    const ctx = this.resolve(socketId);
    if (!ctx) return { ok: false, error: 'Вы не в комнате.' };
    if (!payload.buffer || payload.buffer.length === 0) {
      return { ok: false, error: 'Пустой медиафайл.' };
    }
    if (payload.buffer.length > 10 * 1024 * 1024) {
      return { ok: false, error: 'Слишком большой файл (лимит 10 МБ).' };
    }

    const memeId = `custom-${uuidv4().slice(0, 8)}`;
    const code = ctx.internal.state.code;

    ctx.internal.customMemeBuffers.set(memeId, {
      buffer: payload.buffer,
      mimeType: payload.mimeType || (payload.type === 'video' ? 'video/mp4' : 'audio/wav'),
    });

    const meme: MemeItem = {
      id: memeId,
      title: (payload.title || 'Свой мем').trim().slice(0, 40),
      description: `Добавлено игроком ${ctx.player.nickname}`,
      promptHint: (payload.promptHint || 'Повтори интонацию, тайминг и энергию этого фрагмента!').slice(0, 90),
      type: payload.type,
      url: `/api/ram-meme/${code}/${memeId}`,
      emoji: payload.emoji || (payload.type === 'video' ? '🎬' : '🎵'),
      category: 'Свой пак',
      duration: Math.min(15, Math.max(1.2, Number(payload.duration) || 5)),
      isCustom: true,
      uploadedBy: ctx.player.nickname,
      accentColor: ctx.player.color,
    };

    ctx.internal.state.customMemes.unshift(meme);
    this.emitRoom(ctx.internal);
    return { ok: true, meme };
  }

  public removeCustomMeme(socketId: string, memeId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    const state = ctx.internal.state;
    const nextCustom = state.customMemes.filter((m) => m.id !== memeId);
    if (nextCustom.length === 0 && state.settings.enabledBuiltinMemeIds.length === 0) {
      state.settings.enabledBuiltinMemeIds = [BUILT_IN_MEMES[0].id];
    }
    ctx.internal.customMemeBuffers.delete(memeId);
    state.customMemes = nextCustom;
    this.emitRoom(ctx.internal);
  }

  public startGame(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    const state = ctx.internal.state;
    if (state.phase !== 'lobby') return;

    for (const p of state.players) {
      p.score = 0;
      p.lastRoundDelta = 0;
      p.stats = {
        totalSimilarity: 0,
        roundsRecorded: 0,
        totalReactionsReceived: 0,
        bestSimilarity: 0,
      };
    }
    state.currentRound = 1;
    state.usedMemeIds = [];
    this.startAutomatedRound(ctx.internal);
  }

  /**
   * Automatically picks an unused meme from the room's pack without repeats
   * and starts Demonstration -> Recording -> Gallery -> 6s Results -> Next Round / Podium.
   */
  private startAutomatedRound(internal: InternalRoom): void {
    const state = internal.state;
    internal.recordingBuffers.clear();
    this.io.to(state.code).emit('clear_round_audio');

    state.recordings = {};
    state.scores = {};
    state.activeTurnPlayerId = null;
    state.turnQueue = [];
    internal.reactionsByTarget = {};

    const enabledBuiltins = BUILT_IN_MEMES.filter((m) =>
      state.settings.enabledBuiltinMemeIds.includes(m.id)
    );
    const activePack = [...state.customMemes, ...enabledBuiltins];
    const packPool = activePack.length > 0 ? activePack : BUILT_IN_MEMES;

    let unused = packPool.filter((m) => !state.usedMemeIds.includes(m.id));
    if (unused.length === 0) {
      // Only recycle once every single meme in the pack has been played
      state.usedMemeIds = [];
      unused = packPool;
    }

    const chosen = unused[Math.floor(Math.random() * unused.length)];
    state.usedMemeIds.push(chosen.id);
    state.selectedMeme = chosen;
    state.phase = 'demonstration';

    const demoSec = Math.max(4, Math.ceil(chosen.duration) + 2);
    this.schedulePhaseTimer(internal, demoSec, () => {
      this.enterRecording(internal);
    });

    this.emitRoom(internal);
  }

  private enterRecording(internal: InternalRoom): void {
    const state = internal.state;
    state.phase = 'recording';
    state.recordings = {};
    internal.recordingBuffers.clear();

    const memeDur = state.selectedMeme?.duration || 4;
    // 2.2s countdown (3-2-1-ГОВОРИ) + exact meme.duration + 4.5s decode/upload grace
    const totalWindowSec = Math.ceil(2.2 + memeDur + 4.5);

    const activePlayers = state.players.filter((p) => p.connected);
    const participants = activePlayers.length > 0 ? activePlayers : state.players;

    if (state.settings.recordingMode === 'sequential') {
      state.turnQueue = participants.map((p) => p.id);
      this.startNextSequentialTurn(internal, totalWindowSec);
    } else {
      state.turnQueue = [];
      state.activeTurnPlayerId = null;
      this.schedulePhaseTimer(internal, totalWindowSec, () => {
        this.enterGallery(internal);
      });
      this.emitRoom(internal);
    }
  }

  private startNextSequentialTurn(internal: InternalRoom, turnSec: number): void {
    const state = internal.state;
    const nextId = state.turnQueue.shift() || null;
    if (!nextId) {
      state.activeTurnPlayerId = null;
      this.enterGallery(internal);
      return;
    }

    state.activeTurnPlayerId = nextId;
    this.schedulePhaseTimer(internal, turnSec, () => {
      if (!state.recordings[nextId]) {
        state.recordings[nextId] = {
          playerId: nextId,
          mimeType: '',
          duration: 0,
          skipped: true,
          submittedAt: Date.now(),
          analysis: {
            similarity: 0,
            timingScore: 0,
            intonationScore: 0,
            energyScore: 0,
            activeDuration: 0,
            isSilent: true,
          },
        };
      }
      this.startNextSequentialTurn(internal, turnSec);
    });

    this.emitRoom(internal);
  }

  public submitRecordingInRam(
    socketId: string,
    payload: {
      buffer: Buffer;
      mimeType: string;
      duration: number;
      analysis: VoiceAnalysisMetrics;
    }
  ): void {
    const ctx = this.resolve(socketId);
    if (!ctx) return;
    const state = ctx.internal.state;
    if (state.phase !== 'recording') return;

    const playerId = ctx.player.id;
    const mimeType = payload.mimeType || 'audio/webm;codecs=opus';

    ctx.internal.recordingBuffers.set(playerId, {
      buffer: payload.buffer,
      mimeType,
    });

    this.io.to(state.code).emit('recording_audio_data', {
      playerId,
      mimeType,
      buffer: payload.buffer,
    });

    const meta: PlayerRecordingMeta = {
      playerId,
      mimeType,
      duration: Number(payload.duration) || 0,
      analysis: {
        similarity: Math.max(0, Math.min(100, Math.round(payload.analysis?.similarity ?? 0))),
        timingScore: Math.max(0, Math.min(100, Math.round(payload.analysis?.timingScore ?? 0))),
        intonationScore: Math.max(0, Math.min(100, Math.round(payload.analysis?.intonationScore ?? 0))),
        energyScore: Math.max(0, Math.min(100, Math.round(payload.analysis?.energyScore ?? 0))),
        activeDuration: Number(payload.analysis?.activeDuration ?? 0),
        isSilent: Boolean(payload.analysis?.isSilent),
      },
      submittedAt: Date.now(),
    };

    this.finalizePlayerRecording(ctx.internal, playerId, meta);
  }

  public skipRecording(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx) return;
    if (ctx.internal.state.phase !== 'recording') return;

    this.finalizePlayerRecording(ctx.internal, ctx.player.id, {
      playerId: ctx.player.id,
      mimeType: '',
      duration: 0,
      skipped: true,
      submittedAt: Date.now(),
      analysis: {
        similarity: 0,
        timingScore: 0,
        intonationScore: 0,
        energyScore: 0,
        activeDuration: 0,
        isSilent: true,
      },
    });
  }

  private finalizePlayerRecording(
    internal: InternalRoom,
    playerId: string,
    meta: PlayerRecordingMeta
  ): void {
    const state = internal.state;
    state.recordings[playerId] = meta;
    this.emitRoom(internal);

    if (state.settings.recordingMode === 'sequential') {
      if (state.activeTurnPlayerId === playerId) {
        this.clearTimers(internal);
        const memeDur = state.selectedMeme?.duration || 4;
        const turnSec = Math.ceil(2.2 + memeDur + 4.5);
        setTimeout(() => {
          if (state.phase === 'recording') {
            this.startNextSequentialTurn(internal, turnSec);
          }
        }, 450);
      }
    } else {
      const expected = state.players.filter((p) => p.connected);
      const allSubmitted = expected.every((p) => Boolean(state.recordings[p.id]));
      if (allSubmitted) {
        this.clearTimers(internal);
        setTimeout(() => {
          if (state.phase === 'recording') {
            this.enterGallery(internal);
          }
        }, 550);
      }
    }
  }

  private enterGallery(internal: InternalRoom): void {
    this.clearTimers(internal);
    const state = internal.state;

    const items: RoomState['gallery']['items'] = [];
    for (const p of state.players) {
      const rec = state.recordings[p.id];
      if (rec && !rec.skipped && internal.recordingBuffers.has(p.id)) {
        items.push({ kind: 'player', playerId: p.id });
      }
    }

    // If nobody recorded anything, go straight to round results
    if (items.length === 0) {
      this.computeAndEnterRoundResults(internal);
      return;
    }

    state.phase = 'gallery';
    state.phaseEndsAt = null;
    state.phaseDurationSec = null;
    state.activeTurnPlayerId = null;

    state.gallery = {
      stepIndex: 0,
      items,
      isPlaying: true,
      playToken: Date.now(),
    };

    this.emitRoom(internal);
    this.scheduleGalleryAutoAdvance(internal);
  }

  private scheduleGalleryAutoAdvance(internal: InternalRoom): void {
    if (internal.galleryAutoTimer) {
      clearTimeout(internal.galleryAutoTimer);
      internal.galleryAutoTimer = null;
    }

    const state = internal.state;
    if (state.phase !== 'gallery') return;
    const currentItem = state.gallery.items[state.gallery.stepIndex];
    if (!currentItem) return;

    let clipDuration = 4;
    if (currentItem.kind === 'original') {
      clipDuration = state.selectedMeme?.duration || 4;
    } else {
      clipDuration = state.recordings[currentItem.playerId]?.duration || 4;
    }

    const waitMs = Math.min(20000, Math.max(3200, Math.ceil((clipDuration + 1.8) * 1000)));
    internal.galleryAutoTimer = setTimeout(() => {
      if (state.phase === 'gallery') {
        this.advanceGalleryStep(internal, 1);
      }
    }, waitMs);
  }

  public galleryClipEnded(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    if (ctx.internal.state.phase !== 'gallery') return;
    this.advanceGalleryStep(ctx.internal, 1);
  }

  private advanceGalleryStep(internal: InternalRoom, delta: number): void {
    if (internal.galleryAutoTimer) {
      clearTimeout(internal.galleryAutoTimer);
      internal.galleryAutoTimer = null;
    }
    const g = internal.state.gallery;
    const nextIdx = g.stepIndex + delta;

    if (nextIdx >= g.items.length) {
      this.computeAndEnterRoundResults(internal);
      return;
    }

    g.stepIndex = Math.max(0, nextIdx);
    g.isPlaying = true;
    g.playToken = Date.now();
    this.emitRoom(internal);
    this.scheduleGalleryAutoAdvance(internal);
  }

  public sendReaction(
    socketId: string,
    payload: { emoji: string; targetPlayerId: string | null }
  ): void {
    const ctx = this.resolve(socketId);
    if (!ctx) return;
    const state = ctx.internal.state;
    if (state.phase !== 'gallery' && state.phase !== 'round_results') return;

    const emoji = (payload.emoji || '🔥').slice(0, 8);
    const targetId = payload.targetPlayerId;

    if (targetId && targetId !== ctx.player.id) {
      if (!ctx.internal.reactionsByTarget[targetId]) {
        ctx.internal.reactionsByTarget[targetId] = {};
      }
      ctx.internal.reactionsByTarget[targetId][emoji] =
        (ctx.internal.reactionsByTarget[targetId][emoji] || 0) + 1;
    }

    const event: ReactionEvent = {
      id: uuidv4(),
      fromPlayerId: ctx.player.id,
      fromNickname: ctx.player.nickname,
      targetPlayerId: targetId,
      emoji,
      timestamp: Date.now(),
    };

    this.io.to(state.code).emit('reaction_burst', event);
  }

  private computeAndEnterRoundResults(internal: InternalRoom): void {
    this.clearTimers(internal);
    const state = internal.state;
    const computed: RecordingScore[] = [];

    for (const player of state.players) {
      const rec = state.recordings[player.id];
      const reactions = internal.reactionsByTarget[player.id] || {};
      const totalReactions = Object.values(reactions).reduce((acc, n) => acc + n, 0);

      if (!rec || rec.skipped) {
        computed.push({
          playerId: player.id,
          similarity: 0,
          timingScore: 0,
          intonationScore: 0,
          energyScore: 0,
          basePoints: 0,
          reactionBonus: 0,
          totalRoundPoints: 0,
          rank: state.players.length,
          verdict: pickVerdict(0, true, false),
          reactionCounts: reactions,
        });
        continue;
      }

      const { similarity, timingScore, intonationScore, energyScore, isSilent } = rec.analysis;
      const basePoints = Math.round(similarity * 10);
      const reactionBonus = isSilent ? 0 : Math.min(250, totalReactions * 25);

      computed.push({
        playerId: player.id,
        similarity,
        timingScore,
        intonationScore,
        energyScore,
        basePoints,
        reactionBonus,
        totalRoundPoints: basePoints + reactionBonus,
        rank: 1,
        verdict: pickVerdict(similarity, false, isSilent),
        reactionCounts: reactions,
      });
    }

    computed.sort((a, b) => b.totalRoundPoints - a.totalRoundPoints);
    const podiumBonus = [150, 80, 40];
    computed.forEach((sc, idx) => {
      sc.rank = idx + 1;
      if (sc.similarity > 5 && idx < podiumBonus.length) {
        sc.totalRoundPoints += podiumBonus[idx];
      }
    });

    const scoreMap: Record<string, RecordingScore> = {};
    for (const sc of computed) {
      scoreMap[sc.playerId] = sc;
      const player = state.players.find((p) => p.id === sc.playerId);
      if (player) {
        player.lastRoundDelta = sc.totalRoundPoints;
        player.score += sc.totalRoundPoints;
        if (sc.similarity > 0) {
          player.stats.roundsRecorded += 1;
          player.stats.totalSimilarity += sc.similarity;
          player.stats.bestSimilarity = Math.max(player.stats.bestSimilarity, sc.similarity);
        }
        const reactionSum = Object.values(sc.reactionCounts).reduce((a, b) => a + b, 0);
        player.stats.totalReactionsReceived += reactionSum;
      }
    }

    state.scores = scoreMap;
    state.phase = 'round_results';

    // Free RAM audio buffers right after gallery finishes!
    internal.recordingBuffers.clear();
    this.io.to(state.code).emit('clear_round_audio');

    // Auto-advance after 6 seconds to next round OR final podium!
    this.schedulePhaseTimer(internal, 6, () => {
      if (state.currentRound < state.settings.totalRounds) {
        state.currentRound += 1;
        this.startAutomatedRound(internal);
      } else {
        state.phase = 'game_over';
        state.phaseEndsAt = null;
        state.phaseDurationSec = null;
        this.emitRoom(internal);
      }
    });

    this.emitRoom(internal);
  }

  public playAgain(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    const state = ctx.internal.state;

    this.clearTimers(ctx.internal);
    ctx.internal.recordingBuffers.clear();
    this.io.to(state.code).emit('clear_round_audio');

    state.phase = 'lobby';
    state.currentRound = 0;
    state.selectedMeme = null;
    state.usedMemeIds = [];
    state.recordings = {};
    state.scores = {};
    state.phaseEndsAt = null;
    state.phaseDurationSec = null;
    state.activeTurnPlayerId = null;
    state.turnQueue = [];

    for (const p of state.players) {
      p.score = 0;
      p.lastRoundDelta = 0;
      p.isReady = p.isHost;
      p.stats = {
        totalSimilarity: 0,
        roundsRecorded: 0,
        totalReactionsReceived: 0,
        bestSimilarity: 0,
      };
    }

    this.emitRoom(ctx.internal);
  }

  private resolve(socketId: string): { internal: InternalRoom; player: Player } | null {
    const info = this.socketToRoom.get(socketId);
    if (!info) return null;
    const internal = this.rooms.get(info.code);
    if (!internal) return null;
    const player = internal.state.players.find((p) => p.id === info.playerId);
    if (!player) return null;
    return { internal, player };
  }
}
