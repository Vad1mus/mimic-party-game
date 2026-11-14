import fs from 'fs';
import path from 'path';

export interface AudioMetrics {
  duration: number;
  energyEnvelope: number[];
}

export function extractWavMetrics(filePath: string, buckets = 20): AudioMetrics | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length < 44) return null;
    const sampleRate = buf.readUInt32LE(24) || 22050;
    const dataBytes = buf.length - 44;
    const totalSamples = Math.floor(dataBytes / 2);
    if (totalSamples <= 0) return null;

    const duration = totalSamples / sampleRate;
    const bucketSize = Math.max(1, Math.floor(totalSamples / buckets));
    const raw: number[] = [];

    for (let b = 0; b < buckets; b++) {
      const start = b * bucketSize;
      const end = b === buckets - 1 ? totalSamples : Math.min(totalSamples, start + bucketSize);
      let sumSq = 0;
      let count = 0;
      for (let i = start; i < end; i++) {
        const sample = buf.readInt16LE(44 + i * 2) / 32768;
        sumSq += sample * sample;
        count++;
      }
      raw.push(count > 0 ? Math.sqrt(sumSq / count) : 0);
    }

    const maxVal = Math.max(...raw, 0.0001);
    const energyEnvelope = raw.map((v) => Number((v / maxVal).toFixed(3)));
    return { duration, energyEnvelope };
  } catch {
    return null;
  }
}

export function buildBuiltinMemeMetricsMap(memesDir: string): Record<string, AudioMetrics> {
  const map: Record<string, AudioMetrics> = {};
  if (!fs.existsSync(memesDir)) return map;
  for (const file of fs.readdirSync(memesDir)) {
    if (file.endsWith('.wav')) {
      const metrics = extractWavMetrics(path.join(memesDir, file));
      if (metrics) {
        map[`/memes/${file}`] = metrics;
      }
    }
  }
  return map;
}
