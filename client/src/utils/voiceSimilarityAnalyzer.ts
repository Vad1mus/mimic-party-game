import { VoiceAnalysisMetrics } from '../types/game';

const TARGET_SAMPLE_RATE = 16000;
const SEGMENTS = 80;

function getAudioContextClass(): typeof AudioContext {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  );
}

/**
 * Decodes an Audio/Video Blob or remote URL and resamples to mono 16kHz via OfflineAudioContext.
 */
export async function decodeAndNormalizeAudio(source: Blob | string): Promise<AudioBuffer> {
  const AudioCtx = getAudioContextClass();
  const ctx = new AudioCtx();
  try {
    let arrayBuffer: ArrayBuffer;
    if (typeof source === 'string') {
      const resp = await fetch(source);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      arrayBuffer = await resp.arrayBuffer();
    } else {
      arrayBuffer = await source.arrayBuffer();
    }

    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const maxLenSec = Math.min(15, Math.max(0.2, decoded.duration));
    const frameCount = Math.max(1, Math.floor(maxLenSec * TARGET_SAMPLE_RATE));

    const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const srcNode = offline.createBufferSource();
    srcNode.buffer = decoded;
    srcNode.connect(offline.destination);
    srcNode.start(0, 0, maxLenSec);
    return await offline.startRendering();
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Extracts high-resolution amplitude peaks for HTML5 Canvas Waveform rendering.
 */
export function extractWaveformPeaks(buffer: AudioBuffer, bars = 120): number[] {
  const channel = buffer.getChannelData(0);
  const total = channel.length;
  if (total === 0) return new Array(bars).fill(0.05);

  const step = Math.max(1, Math.floor(total / bars));
  const raw: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = i * step;
    const end = i === bars - 1 ? total : Math.min(total, start + step);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > peak) peak = abs;
    }
    raw.push(peak);
  }
  const maxPeak = Math.max(...raw, 0.01);
  return raw.map((v) => Math.max(0.04, Math.min(1, v / maxPeak)));
}

/**
 * Encodes an AudioBuffer (trimmed <= 15s) to a compact 16-bit mono WAV Blob
 * so custom MP3/MP4/WebM uploads sync cleanly in server RAM across all 10 players.
 */
export function encodeAudioBufferToWavBlob(buffer: AudioBuffer, maxDurationSec = 15): Blob {
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(buffer.length, Math.floor(maxDurationSec * sampleRate));
  const data = buffer.getChannelData(0);

  const wavBuffer = new ArrayBuffer(44 + maxSamples * 2);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + maxSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, maxSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < maxSamples; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

interface VoiceSegmentFeatures {
  rmsEnvelope: number[];
  zcrContour: number[];
  activeDuration: number;
  startOffsetSec: number;
  overallRms: number;
  overallPeak: number;
  isSilent: boolean;
}

function extractSegmentFeatures(buffer: AudioBuffer, segments = SEGMENTS): VoiceSegmentFeatures {
  const samples = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const total = samples.length;

  let sumSqAll = 0;
  let peakAll = 0;
  for (let i = 0; i < total; i++) {
    const v = Math.abs(samples[i]);
    sumSqAll += v * v;
    if (v > peakAll) peakAll = v;
  }
  const overallRms = total > 0 ? Math.sqrt(sumSqAll / total) : 0;

  // Voice Activity Detection (VAD): trim leading & trailing silence
  const vadThreshold = Math.max(0.012, peakAll * 0.08);
  const windowSamples = Math.max(160, Math.floor(sr * 0.02)); // 20ms frame

  let activeStart = 0;
  let activeEnd = total;
  let foundStart = false;

  for (let i = 0; i + windowSamples <= total; i += windowSamples) {
    let winSq = 0;
    for (let j = i; j < i + windowSamples; j++) {
      winSq += samples[j] * samples[j];
    }
    const winRms = Math.sqrt(winSq / windowSamples);
    if (winRms >= vadThreshold) {
      if (!foundStart) {
        activeStart = i;
        foundStart = true;
      }
      activeEnd = Math.min(total, i + windowSamples);
    }
  }

  if (!foundStart || overallRms < 0.006 || peakAll < 0.02) {
    return {
      rmsEnvelope: new Array(segments).fill(0),
      zcrContour: new Array(segments).fill(0),
      activeDuration: 0,
      startOffsetSec: 0,
      overallRms,
      overallPeak: peakAll,
      isSilent: true,
    };
  }

  const activeLen = Math.max(segments, activeEnd - activeStart);
  const activeDuration = activeLen / sr;
  const startOffsetSec = activeStart / sr;

  if (activeDuration < 0.18) {
    return {
      rmsEnvelope: new Array(segments).fill(0),
      zcrContour: new Array(segments).fill(0),
      activeDuration,
      startOffsetSec,
      overallRms,
      overallPeak: peakAll,
      isSilent: true,
    };
  }

  const segSize = Math.max(1, Math.floor(activeLen / segments));
  const rmsRaw: number[] = [];
  const zcrRaw: number[] = [];

  for (let s = 0; s < segments; s++) {
    const segStart = activeStart + s * segSize;
    const segEnd = s === segments - 1 ? activeEnd : Math.min(activeEnd, segStart + segSize);
    const len = Math.max(1, segEnd - segStart);

    let segSq = 0;
    let zeroCrossings = 0;
    for (let i = segStart; i < segEnd; i++) {
      const curr = samples[i];
      segSq += curr * curr;
      if (i > segStart && ((curr >= 0 && samples[i - 1] < 0) || (curr < 0 && samples[i - 1] >= 0))) {
        zeroCrossings++;
      }
    }
    const segRms = Math.sqrt(segSq / len);
    rmsRaw.push(segRms);
    // Only record ZCR meaningfully when segment has voice activity
    zcrRaw.push(segRms >= vadThreshold * 0.7 ? zeroCrossings / len : 0);
  }

  const maxSegRms = Math.max(...rmsRaw, 0.0001);
  const rmsEnvelope = rmsRaw.map((v) => v / maxSegRms);

  return {
    rmsEnvelope,
    zcrContour: zcrRaw,
    activeDuration,
    startOffsetSec,
    overallRms,
    overallPeak: peakAll,
    isSilent: false,
  };
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA <= 1e-8 || denB <= 1e-8) return 0;
  return num / Math.sqrt(denA * denB);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA <= 1e-8 || normB <= 1e-8) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

function computeDeltas(arr: number[]): number[] {
  const deltas: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    deltas.push(arr[i] - arr[i - 1]);
  }
  return deltas;
}

/**
 * Deterministic Web Audio API comparison between Original Meme AudioBuffer and Player Recording AudioBuffer.
 * Zero Math.random() — 100% mathematical audio analysis across 3 metrics:
 * 1. Amplitude Envelope / RMS correlation (80 segments)
 * 2. Active Duration & VAD Timing match
 * 3. Pitch / Zero-Crossing Rate contour dynamics
 */
export function analyzeVoiceSimilarity(
  originalBuffer: AudioBuffer,
  playerBuffer: AudioBuffer
): VoiceAnalysisMetrics {
  const orig = extractSegmentFeatures(originalBuffer, SEGMENTS);
  const player = extractSegmentFeatures(playerBuffer, SEGMENTS);

  if (player.isSilent) {
    return {
      similarity: player.overallPeak > 0.008 ? 3 : 0,
      timingScore: 0,
      intonationScore: 0,
      energyScore: 0,
      activeDuration: player.activeDuration,
      isSilent: true,
    };
  }

  // 1. Amplitude Envelope / Energy Match (0..100)
  const envPearson = (pearsonCorrelation(orig.rmsEnvelope, player.rmsEnvelope) + 1) / 2; // map [-1..1] -> [0..1]
  const envCosine = cosineSimilarity(orig.rmsEnvelope, player.rmsEnvelope);
  // Pause/peak gate agreement
  let gateMatches = 0;
  for (let i = 0; i < SEGMENTS; i++) {
    const oActive = orig.rmsEnvelope[i] > 0.22;
    const pActive = player.rmsEnvelope[i] > 0.22;
    if (oActive === pActive) gateMatches++;
  }
  const gateScore = gateMatches / SEGMENTS;
  const energyRaw = envCosine * 0.45 + envPearson * 0.35 + gateScore * 0.2;
  const energyScore = Math.round(Math.max(5, Math.min(99, energyRaw * 105)));

  // 2. Duration & VAD Timing Match (0..100)
  const durRatio =
    Math.min(orig.activeDuration, player.activeDuration) /
    Math.max(orig.activeDuration, player.activeDuration, 0.25);
  const durDiff = Math.abs(orig.activeDuration - player.activeDuration);
  const expDecay = Math.exp(-durDiff / Math.max(1.8, orig.activeDuration * 0.6));
  const timingRaw = durRatio * 0.55 + expDecay * 0.45;
  const timingScore = Math.round(Math.max(5, Math.min(99, timingRaw * 102)));

  // 3. Pitch / Zero-Crossing Rate Contour Dynamics (0..100)
  const origZcrDelta = computeDeltas(orig.zcrContour);
  const playerZcrDelta = computeDeltas(player.zcrContour);
  const zcrContourCos = cosineSimilarity(orig.zcrContour, player.zcrContour);
  const zcrDeltaCorr = (pearsonCorrelation(origZcrDelta, playerZcrDelta) + 1) / 2;
  const intonationRaw = zcrContourCos * 0.55 + zcrDeltaCorr * 0.45;
  const intonationScore = Math.round(Math.max(5, Math.min(99, intonationRaw * 108)));

  // Calibrated weighted blend
  const weighted = energyScore * 0.44 + timingScore * 0.34 + intonationScore * 0.22;
  const similarity = Math.round(Math.max(6, Math.min(98, weighted)));

  return {
    similarity,
    timingScore,
    intonationScore,
    energyScore,
    activeDuration: Number(player.activeDuration.toFixed(2)),
    isSilent: false,
  };
}
