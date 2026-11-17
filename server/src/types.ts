export type GamePhase =
  | 'lobby'
  | 'demonstration'
  | 'recording'
  | 'gallery'
  | 'round_results'
  | 'game_over';

export type RecordingMode = 'parallel' | 'sequential';
export type MemeMediaType = 'audio' | 'video';

export type CharacterId =
  | 'fox'
  | 'cat'
  | 'robot'
  | 'frog'
  | 'capybara'
  | 'alien'
  | 'panda'
  | 'cyborg'
  | 'owl'
  | 'dino'
  | 'bear'
  | 'octopus'
  | 'shrek'
  | 'ershik';

export interface MemeItem {
  id: string;
  title: string;
  description: string;
  promptHint: string;
  type: MemeMediaType;
  url: string;
  emoji: string;
  category: string;
  duration: number;
  isCustom?: boolean;
  uploadedBy?: string;
  accentColor: string;
}

export interface PlayerStats {
  totalSimilarity: number;
  roundsRecorded: number;
  totalReactionsReceived: number;
  bestSimilarity: number;
}

export interface Player {
  id: string;
  socketId: string;
  nickname: string;
  characterId: CharacterId;
  color: string;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  score: number;
  lastRoundDelta: number;
  stats: PlayerStats;
}

export interface VoiceAnalysisMetrics {
  similarity: number;
  timingScore: number;
  intonationScore: number;
  energyScore: number;
  activeDuration: number;
  isSilent: boolean;
}

export interface PlayerRecordingMeta {
  playerId: string;
  mimeType: string;
  duration: number;
  analysis: VoiceAnalysisMetrics;
  skipped?: boolean;
  submittedAt: number;
}

export interface RecordingScore {
  playerId: string;
  similarity: number;
  timingScore: number;
  intonationScore: number;
  energyScore: number;
  basePoints: number;
  reactionBonus: number;
  totalRoundPoints: number;
  rank: number;
  verdict: string;
  reactionCounts: Record<string, number>;
}

export type GalleryItem =
  | { kind: 'original' }
  | { kind: 'player'; playerId: string };

export interface GalleryState {
  stepIndex: number;
  items: GalleryItem[];
  isPlaying: boolean;
  playToken: number;
}

export interface RoomSettings {
  totalRounds: number;
  recordingMode: RecordingMode;
  enabledBuiltinMemeIds: string[];
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  settings: RoomSettings;
  players: Player[];
  currentRound: number;
  selectedMeme: MemeItem | null;
  usedMemeIds: string[];
  phaseEndsAt: number | null;
  phaseDurationSec: number | null;
  activeTurnPlayerId: string | null;
  turnQueue: string[];
  recordings: Record<string, PlayerRecordingMeta>;
  gallery: GalleryState;
  scores: Record<string, RecordingScore>;
  customMemes: MemeItem[];
}

export interface ReactionEvent {
  id: string;
  fromPlayerId: string;
  fromNickname: string;
  targetPlayerId: string | null;
  emoji: string;
  timestamp: number;
}
