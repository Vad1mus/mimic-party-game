import React from 'react';

interface WaveformVisualizerProps {
  bars?: number[];
  active?: boolean;
  accentColor?: string;
  height?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  bars,
  active = false,
  accentColor = '#ec4899',
  height = 64,
}) => {
  const defaultBars = React.useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) =>
        active ? 0.25 + 0.65 * Math.abs(Math.sin(i * 0.55)) : 0.14
      ),
    [active]
  );

  const data = bars && bars.length > 0 ? bars : defaultBars;

  return (
    <div
      className="flex items-center justify-center gap-1 sm:gap-1.5 w-full px-2"
      style={{ height }}
      aria-hidden="true"
    >
      {data.map((val, idx) => {
        const clamped = Math.max(0.1, Math.min(1, val));
        return (
          <div
            key={idx}
            className={`w-1.5 sm:w-2 rounded-full transition-all duration-75 ${
              active && !bars ? 'animate-pulse' : ''
            }`}
            style={{
              height: `${Math.round(clamped * 100)}%`,
              background: `linear-gradient(to top, ${accentColor}, #22d3ee)`,
              opacity: active ? 0.95 : 0.38,
              animationDelay: active && !bars ? `${(idx % 7) * 80}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
};
