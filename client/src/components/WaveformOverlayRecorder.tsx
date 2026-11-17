import React, { useEffect, useRef } from 'react';

interface WaveformOverlayRecorderProps {
  originalPeaks: number[];
  memeDuration: number;
  isRecording: boolean;
  elapsedSec: number;
  micLevel: number;
}

export const WaveformOverlayRecorder: React.FC<WaveformOverlayRecorderProps> = ({
  originalPeaks,
  memeDuration,
  isRecording,
  elapsedSec,
  micLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const livePeaksRef = useRef<number[]>([]);
  const wasRecordingRef = useRef(false);

  const timelineSec = Math.max(0.8, memeDuration);
  const barsCount = originalPeaks.length || 120;

  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      livePeaksRef.current = new Array(barsCount).fill(0);
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, barsCount]);

  useEffect(() => {
    if (!isRecording) return;
    const progress = Math.min(0.999, Math.max(0, elapsedSec / timelineSec));
    const idx = Math.floor(progress * barsCount);
    if (livePeaksRef.current.length !== barsCount) {
      livePeaksRef.current = new Array(barsCount).fill(0);
    }
    const prev = livePeaksRef.current[idx] || 0;
    livePeaksRef.current[idx] = Math.max(prev, micLevel);
  }, [isRecording, elapsedSec, timelineSec, micLevel, barsCount]);

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
    const padX = 10;
    const innerW = width - padX * 2;
    const barSlot = innerW / barsCount;
    const barW = Math.max(1.5, barSlot * 0.68);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    ctx.lineTo(width - padX, midY);
    ctx.stroke();

    // 1. Original Waveform (cool translucent slate-blue)
    for (let i = 0; i < barsCount; i++) {
      const amp = originalPeaks[i] ?? 0.08;
      const barH = Math.max(4, amp * (height * 0.78));
      const x = padX + i * barSlot;
      const y = midY - barH / 2;

      ctx.fillStyle = 'rgba(96, 165, 250, 0.38)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();
    }

    // 2. Player Live Voice Overlay (neon green -> hot orange on peaks)
    const live = livePeaksRef.current;
    for (let i = 0; i < live.length; i++) {
      const amp = live[i] || 0;
      if (amp <= 0.01) continue;
      const barH = Math.max(4, Math.min(1, amp) * (height * 0.8));
      const x = padX + i * barSlot;
      const y = midY - barH / 2;

      ctx.fillStyle = amp > 0.68 ? 'rgba(251, 146, 60, 0.94)' : 'rgba(74, 222, 128, 0.88)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();
    }

    // 3. Playhead Cursor
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
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs font-bold">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-blue-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-400/60" />
            Оригинал ({timelineSec.toFixed(1)}с)
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
            Твой голос
          </span>
        </div>
        <span className="text-white/60 hidden xs:inline">Попадай в волну!</span>
      </div>

      <div className="relative w-full h-28 sm:h-36 rounded-2xl bg-black/45 border border-white/15 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
