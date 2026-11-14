import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 22050;

function writeWavFile(filePath: string, samples: Float32Array): void {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function synthTrack(durationSec: number, generator: (t: number, dt: number) => number): Float32Array {
  const length = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(length);
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < length; i++) {
    samples[i] = generator(i * dt, dt);
  }
  return samples;
}

function adsr(t: number, start: number, dur: number, a = 0.02, r = 0.08): number {
  const local = t - start;
  if (local < 0 || local > dur) return 0;
  if (local < a) return local / a;
  if (local > dur - r) return Math.max(0, (dur - local) / r);
  return 1;
}

function brass(phase: number): number {
  return (
    0.55 * Math.sin(phase) +
    0.28 * Math.sin(phase * 2) +
    0.15 * Math.sin(phase * 3) +
    0.08 * Math.sin(phase * 4)
  );
}

export function ensureBuiltInMemeAudio(outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Dramatic Dun-Dun-DUUUUN!
  {
    const file = path.join(outputDir, 'dramatic-dun.wav');
    let phase = 0;
    const samples = synthTrack(3.6, (t, dt) => {
      let freq = 0;
      let env = 0;
      if (t >= 0.1 && t < 0.48) {
        freq = 196; // G3
        env = adsr(t, 0.1, 0.38, 0.02, 0.08);
      } else if (t >= 0.55 && t < 0.93) {
        freq = 196;
        env = adsr(t, 0.55, 0.38, 0.02, 0.08);
      } else if (t >= 1.0 && t < 1.38) {
        freq = 196;
        env = adsr(t, 1.0, 0.38, 0.02, 0.08);
      } else if (t >= 1.48 && t < 3.45) {
        const vib = 1 + 0.018 * Math.sin(2 * Math.PI * 5.5 * t);
        freq = 155.56 * vib; // Eb3 dramatic drop!
        env = adsr(t, 1.48, 1.97, 0.04, 0.45);
      }
      phase += 2 * Math.PI * freq * dt;
      return env * 0.72 * brass(phase);
    });
    writeWavFile(file, samples);
  }

  // 2. Sad Trombone (Wah-wah-wah-waaaah)
  {
    const file = path.join(outputDir, 'sad-trombone.wav');
    let phase = 0;
    const samples = synthTrack(3.8, (t, dt) => {
      let freq = 0;
      let env = 0;
      if (t >= 0.1 && t < 0.65) {
        freq = 293.66;
        env = adsr(t, 0.1, 0.55, 0.03, 0.1);
      } else if (t >= 0.72 && t < 1.27) {
        freq = 277.18;
        env = adsr(t, 0.72, 0.55, 0.03, 0.1);
      } else if (t >= 1.34 && t < 1.89) {
        freq = 261.63;
        env = adsr(t, 1.34, 0.55, 0.03, 0.1);
      } else if (t >= 1.96 && t < 3.65) {
        const p = (t - 1.96) / 1.69;
        const slide = 246.94 - p * 42;
        const wobble = 1 + 0.03 * Math.sin(2 * Math.PI * 6 * t);
        freq = slide * wobble;
        env = adsr(t, 1.96, 1.69, 0.04, 0.35);
      }
      phase += 2 * Math.PI * freq * dt;
      const wah = 0.65 + 0.35 * Math.sin(2 * Math.PI * 3.5 * t);
      return env * wah * 0.72 * brass(phase);
    });
    writeWavFile(file, samples);
  }

  // 3. Alien Transmission
  {
    const file = path.join(outputDir, 'alien-signal.wav');
    let phase = 0;
    const notes = [520, 880, 410, 1020, 620, 1180, 350, 740, 960, 480];
    const samples = synthTrack(4.0, (t, dt) => {
      const idx = Math.floor(t / 0.36);
      const localT = t % 0.36;
      const baseFreq = notes[idx % notes.length] ?? 440;
      const chirp = baseFreq + 220 * Math.sin(2 * Math.PI * 9 * t);
      phase += 2 * Math.PI * chirp * dt;
      const env = adsr(localT, 0.02, 0.28, 0.02, 0.06) * adsr(t, 0.05, 3.85, 0.05, 0.25);
      const carrier = Math.sin(phase) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 24 * t));
      return env * 0.65 * carrier;
    });
    writeWavFile(file, samples);
  }

  // 4. Red Alert Siren
  {
    const file = path.join(outputDir, 'alarm-chaos.wav');
    let phase = 0;
    const samples = synthTrack(4.0, (t, dt) => {
      const cycle = t % 0.9;
      const up = cycle < 0.45 ? cycle / 0.45 : 1 - (cycle - 0.45) / 0.45;
      const freq = 420 + up * 540;
      phase += 2 * Math.PI * freq * dt;
      const gate = cycle < 0.8 ? 1 : 0.15;
      const env = adsr(t, 0.05, 3.85, 0.04, 0.2);
      const sq = Math.tanh(2.5 * Math.sin(phase));
      return env * gate * 0.55 * sq;
    });
    writeWavFile(file, samples);
  }

  // 5. Opera Cat Meow Aria
  {
    const file = path.join(outputDir, 'opera-cat.wav');
    let phase = 0;
    const meows = [
      { start: 0.1, dur: 0.75, f1: 380, f2: 720, f3: 480 },
      { start: 0.95, dur: 0.75, f1: 420, f2: 810, f3: 510 },
      { start: 1.85, dur: 1.8, f1: 460, f2: 960, f3: 390 },
    ];
    const samples = synthTrack(3.9, (t, dt) => {
      let out = 0;
      for (const m of meows) {
        if (t >= m.start && t <= m.start + m.dur) {
          const p = (t - m.start) / m.dur;
          const pitch =
            p < 0.4
              ? m.f1 + (m.f2 - m.f1) * (p / 0.4)
              : m.f2 + (m.f3 - m.f2) * ((p - 0.4) / 0.6);
          const vib = 1 + 0.028 * Math.sin(2 * Math.PI * 7.2 * t);
          phase += 2 * Math.PI * pitch * vib * dt;
          const env = adsr(t, m.start, m.dur, 0.08, 0.18);
          const tone = 0.6 * Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.15 * Math.sin(phase * 3);
          out += env * 0.68 * tone;
        }
      }
      return out;
    });
    writeWavFile(file, samples);
  }

  // 6. 8-Bit Boss Fight
  {
    const file = path.join(outputDir, 'boss-8bit.wav');
    let phase1 = 0;
    let phase2 = 0;
    const arp = [330, 392, 494, 659, 587, 494, 440, 392, 330, 392, 523, 659, 784, 659, 523, 440];
    const samples = synthTrack(4.2, (t, dt) => {
      const step = Math.floor(t / 0.24);
      const local = t % 0.24;
      const f = arp[step % arp.length];
      phase1 += 2 * Math.PI * f * dt;
      phase2 += 2 * Math.PI * (f * 0.5) * dt;
      const env = adsr(local, 0, 0.22, 0.01, 0.04) * adsr(t, 0.02, 4.1, 0.02, 0.2);
      const sq1 = Math.sin(phase1) >= 0 ? 0.5 : -0.5;
      const sq2 = Math.sin(phase2) >= 0 ? 0.3 : -0.3;
      return env * 0.6 * (sq1 + sq2);
    });
    writeWavFile(file, samples);
  }

  // 7. Glitch Robot Breakdown
  {
    const file = path.join(outputDir, 'robot-dj.wav');
    let phase = 0;
    const samples = synthTrack(4.0, (t, dt) => {
      const env = adsr(t, 0.05, 3.85, 0.03, 0.3);
      let freq = 220;
      if (t < 1.2) freq = 240 + 40 * Math.floor((t * 10) % 4);
      else if (t < 2.3) freq = 180 + 80 * Math.floor((t * 16) % 3);
      else freq = Math.max(55, 320 - (t - 2.3) * 165);
      phase += 2 * Math.PI * freq * dt;
      const mod = Math.sin(2 * Math.PI * 28 * t) > 0 ? 1 : 0.2;
      const saw = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
      return env * mod * 0.55 * saw;
    });
    writeWavFile(file, samples);
  }

  // 8. Victory Fanfare
  {
    const file = path.join(outputDir, 'victory-fanfare.wav');
    let phase = 0;
    const seq = [
      { start: 0.08, dur: 0.2, freq: 523.25 },
      { start: 0.32, dur: 0.2, freq: 659.25 },
      { start: 0.56, dur: 0.2, freq: 783.99 },
      { start: 0.82, dur: 0.55, freq: 1046.5 },
      { start: 1.45, dur: 0.22, freq: 783.99 },
      { start: 1.72, dur: 1.6, freq: 1046.5 },
    ];
    const samples = synthTrack(3.5, (t, dt) => {
      let activeFreq = 0;
      let env = 0;
      for (const n of seq) {
        if (t >= n.start && t <= n.start + n.dur) {
          activeFreq = n.freq;
          env = adsr(t, n.start, n.dur, 0.015, 0.08);
        }
      }
      const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 6 * t);
      phase += 2 * Math.PI * activeFreq * vib * dt;
      return env * 0.68 * brass(phase);
    });
    writeWavFile(file, samples);
  }
}
