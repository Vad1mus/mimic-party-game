import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Volume2, Video } from 'lucide-react';
import { MemeItem } from '../types/game';
import { WaveformVisualizer } from './WaveformVisualizer';
import { resolveMediaUrl } from '../utils/serverUrl';

interface MemePlayerProps {
  meme: MemeItem;
  autoPlay?: boolean;
  playTrigger?: number;
  onEnded?: () => void;
  compact?: boolean;
}

export const MemePlayer: React.FC<MemePlayerProps> = ({
  meme,
  autoPlay = false,
  playTrigger = 0,
  onEnded,
  compact = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needsManualPlay, setNeedsManualPlay] = useState(false);

  const mediaUrl = resolveMediaUrl(meme.url);

  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
    setNeedsManualPlay(false);
  }, [meme.id]);

  const triggerPlay = React.useCallback(async () => {
    const el = meme.type === 'video' ? videoRef.current : audioRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      await el.play();
      setIsPlaying(true);
      setNeedsManualPlay(false);
    } catch {
      setNeedsManualPlay(true);
      setIsPlaying(false);
    }
  }, [meme.type]);

  useEffect(() => {
    if (autoPlay || playTrigger > 0) {
      const t = window.setTimeout(() => {
        triggerPlay();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [autoPlay, playTrigger, mediaUrl, triggerPlay]);

  const handleTimeUpdate = (el: HTMLMediaElement) => {
    if (!el.duration || !Number.isFinite(el.duration)) return;
    const maxDur = Math.min(el.duration, meme.duration || 15, 15);
    setProgress(Math.min(100, (el.currentTime / maxDur) * 100));
    if (el.currentTime >= maxDur) {
      el.pause();
      setIsPlaying(false);
      setProgress(100);
      onEnded?.();
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
    onEnded?.();
  };

  return (
    <div className="w-full rounded-3xl bg-black/35 border border-white/15 p-4 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-lg"
            style={{
              backgroundColor: `${meme.accentColor}33`,
              border: `1px solid ${meme.accentColor}88`,
            }}
          >
            {meme.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-white truncate">
                {meme.title}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-cyan-300 shrink-0">
                {meme.type === 'video' ? (
                  <Video className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
                {meme.type === 'video' ? 'Видео' : 'Аудио'}
              </span>
            </div>
            {!compact && (
              <p className="text-xs sm:text-sm text-white/70 line-clamp-1">{meme.description}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={triggerPlay}
          className="party-btn-ghost shrink-0 text-xs sm:text-sm px-3.5 py-2"
        >
          {isPlaying ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
          <span className="hidden sm:inline">{isPlaying ? 'Заново' : 'Включить'}</span>
        </button>
      </div>

      {meme.type === 'video' ? (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-60 mx-auto flex items-center justify-center border border-white/10">
          <video
            ref={videoRef}
            src={mediaUrl}
            playsInline
            crossOrigin="anonymous"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
            onEnded={handleEnded}
            className="w-full h-full object-contain"
          />
          {needsManualPlay && (
            <button
              type="button"
              onClick={triggerPlay}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm text-white hover:bg-black/50 transition"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 shadow-xl">
                <Play className="h-7 w-7 fill-current ml-1" />
              </span>
              <span className="font-bold text-sm">Нажмите, чтобы включить звук</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/90 to-fuchsia-950/60 border border-white/10 p-4 flex flex-col items-center justify-center gap-2.5">
          <audio
            ref={audioRef}
            src={mediaUrl}
            crossOrigin="anonymous"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
            onEnded={handleEnded}
          />
          <WaveformVisualizer
            active={isPlaying}
            accentColor={meme.accentColor}
            height={compact ? 44 : 56}
          />
          {needsManualPlay && (
            <button
              type="button"
              onClick={triggerPlay}
              className="inline-flex items-center gap-2 rounded-full bg-pink-500 hover:bg-pink-400 px-4 py-1.5 text-xs font-bold text-white shadow-lg transition"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Включить звук
            </button>
          )}
        </div>
      )}

      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
