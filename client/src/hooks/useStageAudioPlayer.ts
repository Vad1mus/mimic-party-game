import { useCallback, useEffect, useRef, useState } from 'react';

export function useStageAudioPlayer(onEnded?: () => void) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0);
  const [needsClick, setNeedsClick] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  const activePlayIdRef = useRef(0);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const stop = useCallback(() => {
    activePlayIdRef.current += 1;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => {
      stop();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, [stop]);

  const playSource = useCallback(
    async (src: string | Blob) => {
      stop();
      setNeedsClick(false);
      const myPlayId = activePlayIdRef.current;

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          ctxRef.current = new AudioCtx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            // Autoplay might require user gesture
          }
        }
        if (ctx.state === 'suspended') {
          setNeedsClick(true);
          return;
        }

        let arrayBuf: ArrayBuffer;
        if (typeof src === 'string') {
          const resp = await fetch(src);
          if (!resp.ok) throw new Error('Failed to fetch audio');
          arrayBuf = await resp.arrayBuffer();
        } else {
          arrayBuf = await src.arrayBuffer();
        }

        if (activePlayIdRef.current !== myPlayId) return;
        const audioBuffer = await ctx.decodeAudioData(arrayBuf);
        if (activePlayIdRef.current !== myPlayId) return;

        const node = ctx.createBufferSource();
        node.buffer = audioBuffer;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;

        node.connect(analyser);
        analyser.connect(ctx.destination);

        const timeData = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (activePlayIdRef.current !== myPlayId) return;
          analyser.getByteTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const c = (timeData[i] - 128) / 128;
            sumSq += c * c;
          }
          const rms = Math.sqrt(sumSq / timeData.length);
          setVolume(Math.min(1, rms * 4.2));
          rafRef.current = requestAnimationFrame(tick);
        };

        node.onended = () => {
          if (activePlayIdRef.current !== myPlayId) return;
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          setIsPlaying(false);
          setVolume(0);
          onEndedRef.current?.();
        };

        sourceRef.current = node;
        node.start(0);
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (activePlayIdRef.current === myPlayId) {
          setIsPlaying(false);
          setNeedsClick(true);
        }
      }
    },
    [stop]
  );

  return {
    isPlaying,
    volume,
    needsClick,
    playSource,
    stop,
  };
}
