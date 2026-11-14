export type GamePhase =
  | 'lobby'
  | 'content_select'
  | 'demonstration'
  | 'recording'
  | 'gallery'
  | 'scoring'
  | 'round_results'
  | 'game_over';

export type RecordingMode = 'parallel' | 'sequential';
export type SelectorMode = 'host' | 'rotating' | 'random';
export type MemeMediaType = 'audio' | 'video';

export type CharacterId =
  | 'fox'
  | 'robot'
  | 'frog'
  | 'cat'
  | 'alien'
  | 'panda'
  | 'owl'
  | 'dino'
  | 'bear'
  | 'octopus';

export interface CharacterMeta {
  id: CharacterId;
  name: string;
  primary: string;
  secondary: string;
}

export const CHARACTER_CATALOG: Record<CharacterId, CharacterMeta> = {
  fox: { id: 'fox', name: 'Хитрый Лис', primary: '#fb923c', secondary: '#ea580c' },
  robot: { id: 'robot', name: 'Кибер-Бот', primary: '#22d3ee', secondary: '#0284c7' },
  frog: { id: 'frog', name: 'Диско-Жаба', primary: '#a3e635', secondary: '#4d7c0f' },
  cat: { id: 'cat', name: 'Оперный Кот', primary: '#f472b6', secondary: '#be185d' },
  alien: { id: 'alien', name: 'Марсианин', primary: '#34d399', secondary: '#047857' },
  panda: { id: 'panda', name: 'Панда-Рок', primary: '#818cf8', secondary: '#4338ca' },
  owl: { id: 'owl', name: 'Ночная Сова', primary: '#60a5fa', secondary: '#1d4ed8' },
  dino: { id: 'dino', name: 'Рекс-Дино', primary: '#fb7185', secondary: '#be123c' },
  bear: { id: 'bear', name: 'Гризли-DJ', primary: '#fbbf24', secondary: '#b45309' },
  octopus: { id: 'octopus', name: 'Осьминог', primary: '#e879f9', secondary: '#a21caf' },
};

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
  recordingTimeSec: number;
  recordingMode: RecordingMode;
  selectorMode: SelectorMode;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  settings: RoomSettings;
  players: Player[];
  currentRound: number;
  selectorPlayerId: string | null;
  selectedMeme: MemeItem | null;
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

export const REACTION_EMOJIS = ['😂', '🔥', '🎭', '👏', '💀', '🤯'];
