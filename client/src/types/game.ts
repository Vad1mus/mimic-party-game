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

export interface CharacterMeta {
  id: CharacterId;
  name: string;
  primary: string;
  secondary: string;
}

export const CHARACTER_LIST: CharacterMeta[] = [
  { id: 'fox', name: 'Лис', primary: '#fb923c', secondary: '#ea580c' },
  { id: 'cat', name: 'Кот', primary: '#f472b6', secondary: '#be185d' },
  { id: 'robot', name: 'Робот', primary: '#22d3ee', secondary: '#0284c7' },
  { id: 'frog', name: 'Жаба', primary: '#a3e635', secondary: '#4d7c0f' },
  { id: 'capybara', name: 'Капибара', primary: '#d97706', secondary: '#92400e' },
  { id: 'alien', name: 'Пришелец', primary: '#34d399', secondary: '#047857' },
  { id: 'panda', name: 'Панда', primary: '#818cf8', secondary: '#4338ca' },
  { id: 'cyborg', name: 'Киборг', primary: '#38bdf8', secondary: '#0369a1' },
  { id: 'owl', name: 'Сова', primary: '#60a5fa', secondary: '#1d4ed8' },
  { id: 'dino', name: 'Дино', primary: '#fb7185', secondary: '#be123c' },
  { id: 'bear', name: 'Медведь', primary: '#fbbf24', secondary: '#b45309' },
  { id: 'octopus', name: 'Осьминог', primary: '#e879f9', secondary: '#a21caf' },
  { id: 'shrek', name: 'Шрек', primary: '#84cc16', secondary: '#4d7c0f' },
  { id: 'ershik', name: 'Ёршик', primary: '#22d3ee', secondary: '#0891b2' },
];

export const CHARACTER_CATALOG: Record<CharacterId, CharacterMeta> = Object.fromEntries(
  CHARACTER_LIST.map((c) => [c.id, c])
) as Record<CharacterId, CharacterMeta>;

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

export type AudienceMood = 'idle' | 'laugh' | 'surprised' | 'cry' | 'cheer';

export const REACTION_EMOJIS = ['😂', '😭', '😮', '🔥', '👏', '💀'];
