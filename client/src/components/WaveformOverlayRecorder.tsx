import React, { useEffect, useRef } from 'react';

interface WaveformOverlayRecorderProps {
  originalPeaks: number[];
  originalDuration: number;
  maxRecordSec: number;
  isRecording: boolean;
  elapsedSec: number;
  micLevel: number; // 0..1 live AnalyserNode
}

export const WaveformOverlayRecorder: React.FC<WaveformOverlayRecorderProps> = ({
  originalPeaks,
  originalDuration,
  maxRecordSec,
  isRecording,
  elapsedSec,
  micLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const livePeaksRef = useRef<number[]>([]);
  const wasRecordingRef = useRef(false);

  const timelineSec = Math.min(maxRecordSec, Math.max(originalDuration, 3.0));
  const barsCount = originalPeaks.length || 120;

  // Reset live overlay when a fresh recording starts
  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      livePeaksRef.current = new Array(barsCount).fill(0);
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, barsCount]);

  // Sample live mic level into the current playhead bucket
  useEffect(() => {
    if (!isRecording) return;
    const progress = Math.min(0.999, Math.max(0, elapsedSec / timelineSec));
    const idx = Math.floor(progress * barsCount);
    const arr = livePeaksRef.current;
    if (arr.length !== barsCount) {
      livePeaksRef.current = new Array(barsCount).fill(0);
    }
    const prev = livePeaksRef.current[idx] || 0;
    livePeaksRef.current[idx] = Math.max(prev, micLevel);
  }, [isRecording, elapsedSec, timelineSec, micLevel, barsCount]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const midY = height / 2;
    const padX = 12;
    const innerW = width - padX * 2;
    const barSlot = innerW / barsCount;
    const barW = Math.max(2, barSlot * 0.68);

    // Subtle centerline & quarter grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    ctx.lineTo(width - padX, midY);
    ctx.stroke();

    for (let q = 1; q <= 3; q++) {
      const gx = padX + (innerW * q) / 4;
      ctx.beginPath();
      ctx.moveTo(gx, 10);
      ctx.lineTo(gx, height - 10);
      ctx.stroke();
    }

    // 1. Draw Original Waveform (cool translucent slate-blue / cyan)
    for (let i = 0; i < barsCount; i++) {
      const amp = originalPeaks[i] ?? 0.08;
      const barH = Math.max(4, amp * (height * 0.78));
      const x = padX + i * barSlot;
      const y = midY - barH / 2;

      ctx.fillStyle = 'rgba(96, 165, 250, 0.36)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();
    }

    // 2. Draw Player Live Overlay Waveform (bright neon green -> hot orange on peaks)
    const live = livePeaksRef.current;
    for (let i = 0; i < live.length; i++) {
      const amp = live[i] || 0;
      if (amp <= 0.01) continue;
      const barH = Math.max(4, Math.min(1, amp) * (height * 0.78));
      const x = padX + i * barSlot;
      const y = midY - barH / 2;

      ctx.fillStyle = amp > 0.68 ? 'rgba(251, 146, 60, 0.92)' : 'rgba(74, 222, 128, 0.85)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();
    }

    // 3. Draw Glowing Playhead Cursor during recording
    if (isRecording) {
      const progress = Math.min(1, Math.max(0, elapsedSec / timelineSec));
      const cursorX = padX + progress * innerW;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cursorX, 6);
      ctx.lineTo(cursorX, height - 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [originalPeaks, isRecording, elapsedSec, timelineSec, micLevel, barsCount]);

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-blue-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-400/60" />
            Оригинал ({originalDuration.toFixed(1)}с)
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
            Твой голос (поверх)
          </span>
        </div>
        <span className="text-white/60">Попадай в пики и паузы!</span>
      </div>

      <div className="relative w-full h-32 sm:h-36 rounded-2xl bg-black/45 border border-white/15 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
