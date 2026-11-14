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

const CHARACTER_POOL: CharacterId[] = [
  'fox',
  'robot',
  'frog',
  'cat',
  'alien',
  'panda',
  'owl',
  'dino',
  'bear',
  'octopus',
];

const CHARACTER_COLORS: Record<CharacterId, string> = {
  fox: '#f97316',
  robot: '#06b6d4',
  frog: '#84cc16',
  cat: '#ec4899',
  alien: '#10b981',
  panda: '#6366f1',
  owl: '#3b82f6',
  dino: '#f43f5e',
  bear: '#f59e0b',
  octopus: '#d946ef',
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

function assignUniqueCharacter(existingPlayers: Player[]): CharacterId {
  const used = new Set(existingPlayers.map((p) => p.characterId));
  const available = CHARACTER_POOL.filter((c) => !used.has(c));
  const pool = available.length > 0 ? available : CHARACTER_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickVerdict(similarity: number, skipped?: boolean, isSilent?: boolean): string {
  if (skipped) return 'Пропущено (микрофон отдыхает) 🙈';
  if (isSilent || similarity <= 5) return 'Режим ниндзя — в микрофоне тишина! 🥷';
  if (similarity >= 88) return 'Абсолютный Оскар! Копия один в один! 🏆';
  if (similarity >= 74) return 'Блестящая пародия! Ритм и тон пойманы! 🔥';
  if (similarity >= 58) return 'Очень годно! Отличная энергия! 👏';
  if (similarity >= 40) return 'Почти попал, но с авторской изюминкой! 😂';
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
    }, seconds * 1000);
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
    payload: { playerId?: string; nickname: string }
  ): { ok: true; room: RoomState; playerId: string } | { ok: false; error: string } {
    const nickname = (payload.nickname || '').trim().slice(0, 20);
    if (!nickname) return { ok: false, error: 'Введите никнейм!' };

    const code = generateRoomCode(new Set(this.rooms.keys()));
    const playerId = payload.playerId || uuidv4();
    const characterId = assignUniqueCharacter([]);

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
        recordingTimeSec: 12,
        recordingMode: 'parallel',
        selectorMode: 'host',
      },
      players: [host],
      currentRound: 0,
      selectorPlayerId: null,
      selectedMeme: null,
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
    payload: { code: string; playerId?: string; nickname: string }
  ): { ok: true; room: RoomState; playerId: string } | { ok: false; error: string } {
    const code = (payload.code || '').trim().toUpperCase();
    const internal = this.rooms.get(code);
    if (!internal) {
      return { ok: false, error: `Комната «${code}» не найдена. Проверьте код!` };
    }

    const state = internal.state;
    const nickname = (payload.nickname || '').trim().slice(0, 20);
    if (!nickname) return { ok: false, error: 'Введите никнейм!' };

    // Reconnection by playerId
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

    const characterId = assignUniqueCharacter(state.players);
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
    if (typeof partial.recordingTimeSec === 'number') {
      s.recordingTimeSec = Math.max(5, Math.min(20, Math.round(partial.recordingTimeSec)));
    }
    if (partial.recordingMode === 'parallel' || partial.recordingMode === 'sequential') {
      s.recordingMode = partial.recordingMode;
    }
    if (partial.selectorMode === 'host' || partial.selectorMode === 'rotating' || partial.selectorMode === 'random') {
      s.selectorMode = partial.selectorMode;
    }
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
    this.enterContentSelect(ctx.internal);
  }

  private enterContentSelect(internal: InternalRoom): void {
    const state = internal.state;
    // Auto-cleanup RAM recording buffers from previous round!
    internal.recordingBuffers.clear();
    this.io.to(state.code).emit('clear_round_audio');

    state.phase = 'content_select';
    state.selectedMeme = null;
    state.recordings = {};
    state.scores = {};
    state.activeTurnPlayerId = null;
    state.turnQueue = [];
    internal.reactionsByTarget = {};

    const connectedPlayers = state.players.filter((p) => p.connected);
    const pool = connectedPlayers.length > 0 ? connectedPlayers : state.players;
    const host = pool.find((p) => p.isHost) || pool[0];

    if (state.settings.selectorMode === 'host') {
      state.selectorPlayerId = host?.id || null;
    } else if (state.settings.selectorMode === 'rotating') {
      const idx = (state.currentRound - 1) % pool.length;
      state.selectorPlayerId = pool[idx]?.id || host?.id || null;
    } else {
      state.selectorPlayerId = pool[Math.floor(Math.random() * pool.length)]?.id || host?.id || null;
    }

    this.schedulePhaseTimer(internal, 60, () => {
      const allMemes = [...state.customMemes, ...BUILT_IN_MEMES];
      const randomMeme = allMemes[Math.floor(Math.random() * allMemes.length)];
      this.applySelectedMeme(internal, randomMeme);
    });

    this.emitRoom(internal);
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
      duration: Math.min(15, Math.max(1, Number(payload.duration) || 6)),
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
    ctx.internal.customMemeBuffers.delete(memeId);
    ctx.internal.state.customMemes = ctx.internal.state.customMemes.filter((m) => m.id !== memeId);
    this.emitRoom(ctx.internal);
  }

  public selectMeme(socketId: string, memeId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx) return;
    const state = ctx.internal.state;
    if (state.phase !== 'content_select') return;
    if (!ctx.player.isHost && ctx.player.id !== state.selectorPlayerId) return;

    const allMemes = [...state.customMemes, ...BUILT_IN_MEMES];
    const meme = allMemes.find((m) => m.id === memeId);
    if (!meme) return;

    this.applySelectedMeme(ctx.internal, meme);
  }

  private applySelectedMeme(internal: InternalRoom, meme: MemeItem): void {
    internal.state.selectedMeme = meme;
    internal.state.phase = 'demonstration';

    const demoSec = Math.min(20, Math.max(8, Math.ceil((meme.duration || 5) + 5)));
    this.schedulePhaseTimer(internal, demoSec, () => {
      this.enterRecording(internal);
    });

    this.emitRoom(internal);
  }

  public advanceFromDemo(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    if (ctx.internal.state.phase !== 'demonstration') return;
    this.enterRecording(ctx.internal);
  }

  private enterRecording(internal: InternalRoom): void {
    const state = internal.state;
    state.phase = 'recording';
    state.recordings = {};
    internal.recordingBuffers.clear();

    const activePlayers = state.players.filter((p) => p.connected);
    const participants = activePlayers.length > 0 ? activePlayers : state.players;

    if (state.settings.recordingMode === 'sequential') {
      state.turnQueue = participants.map((p) => p.id);
      this.startNextSequentialTurn(internal);
    } else {
      state.turnQueue = [];
      state.activeTurnPlayerId = null;
      this.schedulePhaseTimer(internal, state.settings.recordingTimeSec + 4, () => {
        this.enterGallery(internal);
      });
      this.emitRoom(internal);
    }
  }

  private startNextSequentialTurn(internal: InternalRoom): void {
    const state = internal.state;
    const nextId = state.turnQueue.shift() || null;
    if (!nextId) {
      state.activeTurnPlayerId = null;
      this.enterGallery(internal);
      return;
    }

    state.activeTurnPlayerId = nextId;
    this.schedulePhaseTimer(internal, state.settings.recordingTimeSec + 4, () => {
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
      this.startNextSequentialTurn(internal);
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

    // Store compressed audio in RAM and broadcast directly to all room peers over Socket.io
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
        setTimeout(() => {
          if (state.phase === 'recording') {
            this.startNextSequentialTurn(internal);
          }
        }, 500);
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
        }, 650);
      }
    }
  }

  public forceFinishRecording(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    if (ctx.internal.state.phase !== 'recording') return;
    this.enterGallery(ctx.internal);
  }

  private enterGallery(internal: InternalRoom): void {
    this.clearTimers(internal);
    const state = internal.state;
    state.phase = 'gallery';
    state.phaseEndsAt = null;
    state.phaseDurationSec = null;
    state.activeTurnPlayerId = null;

    const items: RoomState['gallery']['items'] = [{ kind: 'original' }];
    for (const p of state.players) {
      const rec = state.recordings[p.id];
      if (rec && !rec.skipped && internal.recordingBuffers.has(p.id)) {
        items.push({ kind: 'player', playerId: p.id });
      }
    }

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

    let clipDuration = 5;
    if (currentItem.kind === 'original') {
      clipDuration = state.selectedMeme?.duration || 5;
    } else {
      clipDuration = state.recordings[currentItem.playerId]?.duration || 4;
    }

    const waitMs = Math.min(20000, Math.max(4500, Math.ceil((clipDuration + 3.0) * 1000)));
    internal.galleryAutoTimer = setTimeout(() => {
      if (state.phase === 'gallery') {
        this.advanceGalleryStep(internal, 1);
      }
    }, waitMs);
  }

  public galleryNavigate(socketId: string, action: 'next' | 'prev' | 'replay' | 'ended'): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    const state = ctx.internal.state;
    if (state.phase !== 'gallery') return;

    if (action === 'replay') {
      state.gallery.isPlaying = true;
      state.gallery.playToken = Date.now();
      this.emitRoom(ctx.internal);
      this.scheduleGalleryAutoAdvance(ctx.internal);
      return;
    }

    if (action === 'prev') {
      this.advanceGalleryStep(ctx.internal, -1);
      return;
    }

    if (action === 'next' || action === 'ended') {
      this.advanceGalleryStep(ctx.internal, 1);
    }
  }

  private advanceGalleryStep(internal: InternalRoom, delta: number): void {
    if (internal.galleryAutoTimer) {
      clearTimeout(internal.galleryAutoTimer);
      internal.galleryAutoTimer = null;
    }
    const g = internal.state.gallery;
    const nextIdx = g.stepIndex + delta;

    if (nextIdx < 0) {
      g.stepIndex = 0;
      g.isPlaying = true;
      g.playToken = Date.now();
      this.emitRoom(internal);
      this.scheduleGalleryAutoAdvance(internal);
      return;
    }

    if (nextIdx >= g.items.length) {
      this.enterScoring(internal);
      return;
    }

    g.stepIndex = nextIdx;
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
    if (state.phase !== 'gallery' && state.phase !== 'scoring') return;

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

  private enterScoring(internal: InternalRoom): void {
    this.clearTimers(internal);
    const state = internal.state;
    state.phase = 'scoring';

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

    this.schedulePhaseTimer(internal, 18, () => {
      this.enterRoundResults(internal);
    });

    this.emitRoom(internal);
  }

  public advanceToResults(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    if (ctx.internal.state.phase !== 'scoring') return;
    this.enterRoundResults(ctx.internal);
  }

  private enterRoundResults(internal: InternalRoom): void {
    this.clearTimers(internal);
    const state = internal.state;
    state.phase = 'round_results';
    state.phaseEndsAt = null;
    state.phaseDurationSec = null;
    // Free RAM buffers right after scoring/gallery ends!
    internal.recordingBuffers.clear();
    this.io.to(state.code).emit('clear_round_audio');
    this.emitRoom(internal);
  }

  public nextRound(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    const state = ctx.internal.state;
    if (state.phase !== 'round_results' && state.phase !== 'scoring') return;

    if (state.currentRound < state.settings.totalRounds) {
      state.currentRound += 1;
      this.enterContentSelect(ctx.internal);
    } else {
      this.clearTimers(ctx.internal);
      internalCleanup(ctx.internal, this.io);
      state.phase = 'game_over';
      state.phaseEndsAt = null;
      state.phaseDurationSec = null;
      this.emitRoom(ctx.internal);
    }
  }

  public playAgain(socketId: string): void {
    const ctx = this.resolve(socketId);
    if (!ctx || !ctx.player.isHost) return;
    const state = ctx.internal.state;

    this.clearTimers(ctx.internal);
    internalCleanup(ctx.internal, this.io);

    state.phase = 'lobby';
    state.currentRound = 0;
    state.selectedMeme = null;
    state.selectorPlayerId = null;
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

function internalCleanup(internal: InternalRoom, io: Server): void {
  internal.recordingBuffers.clear();
  io.to(internal.state.code).emit('clear_round_audio');
}
