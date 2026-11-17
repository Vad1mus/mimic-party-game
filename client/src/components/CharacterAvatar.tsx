import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AudienceMood, CharacterId } from '../types/game';

const AvatarMoodContext = createContext<AudienceMood>('idle');

interface CharacterAvatarProps {
  characterId: CharacterId;
  size?: number;
  mouthOpen?: number; // 0..1 driven in real time by AnalyserNode
  isSpeaking?: boolean;
  dimmed?: boolean;
  idle?: boolean;
  mood?: AudienceMood;
  className?: string;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  characterId,
  size = 96,
  mouthOpen = 0,
  isSpeaking = false,
  dimmed = false,
  idle = true,
  mood = 'idle',
  className = '',
}) => {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let timeoutId = 0;
    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 3400;
      timeoutId = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  const moodMouth =
    mood === 'laugh'
      ? 0.68
      : mood === 'surprised'
      ? 0.85
      : mood === 'cry'
      ? 0.5
      : mood === 'cheer'
      ? 0.55
      : 0;
  const clampedMouth = Math.max(0, Math.min(1, isSpeaking ? mouthOpen : Math.max(mouthOpen, moodMouth)));
  const jawHeight = 3 + clampedMouth * 15;
  const bounceY = isSpeaking ? -clampedMouth * 12 : 0;

  const animateProps = isSpeaking
    ? {
        y: bounceY,
        rotate: clampedMouth > 0.5 ? [-2, 2, 0] : 0,
        opacity: dimmed ? 0.55 : 1,
        scale: 1 + clampedMouth * 0.07,
      }
    : mood === 'laugh'
    ? {
        y: [0, -7, 0, -5, 0],
        rotate: [-4, 4, -4],
        opacity: dimmed ? 0.8 : 1,
        scale: 1.04,
      }
    : mood === 'surprised'
    ? {
        y: [0, -10, -2],
        rotate: [0, -5, 5, 0],
        opacity: dimmed ? 0.85 : 1,
        scale: [1, 1.12, 1.05],
      }
    : mood === 'cry'
    ? {
        y: [0, 2, 0],
        rotate: [-3, 3, -3],
        opacity: dimmed ? 0.8 : 1,
        scale: 0.98,
      }
    : mood === 'cheer'
    ? {
        y: [0, -9, 0],
        rotate: [-3, 3, -3],
        opacity: dimmed ? 0.85 : 1,
        scale: 1.05,
      }
    : {
        y: idle ? [0, -4, 0] : 0,
        rotate: idle ? [-1.2, 1.2, -1.2] : 0,
        opacity: dimmed ? 0.65 : 1,
        scale: 1,
      };

  const transitionProps = isSpeaking
    ? { type: 'spring' as const, stiffness: 420, damping: 20 }
    : mood !== 'idle'
    ? { duration: mood === 'laugh' ? 0.45 : 0.65, repeat: Infinity, ease: 'easeInOut' as const }
    : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      animate={animateProps}
      transition={transitionProps}
    >
      <AvatarMoodContext.Provider value={mood}>
        <svg
          viewBox="0 0 120 120"
          width={size}
          height={size}
          className="overflow-visible drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
        >
          {renderCharacterSvg(characterId, blink, jawHeight, clampedMouth)}
          {renderMoodOverlay(mood)}
        </svg>
      </AvatarMoodContext.Provider>
    </motion.div>
  );
};

function renderMoodOverlay(mood: AudienceMood) {
  if (mood === 'laugh') {
    return (
      <g>
        {/* Happy squinting eye arches & blushing cheeks */}
        <circle cx="29" cy="67" r="6" fill="#fb7185" opacity="0.55" />
        <circle cx="91" cy="67" r="6" fill="#fb7185" opacity="0.55" />
      </g>
    );
  }
  if (mood === 'cry') {
    return (
      <g>
        {/* Animated cartoon tear streams */}
        <path d="M38,60 Q32,74 34,88" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx="34" cy="92" r="3.5" fill="#7dd3fc" />
        <path d="M82,60 Q88,74 86,88" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx="86" cy="92" r="3.5" fill="#7dd3fc" />
      </g>
    );
  }
  if (mood === 'surprised') {
    return (
      <g stroke="#fde047" strokeWidth="3" strokeLinecap="round">
        <line x1="16" y1="22" x2="26" y2="30" />
        <line x1="104" y1="22" x2="94" y2="30" />
        <line x1="60" y1="4" x2="60" y2="14" />
      </g>
    );
  }
  return null;
}

function Eyes({
  blink,
  leftX = 43,
  rightX = 77,
  y = 56,
  eyeColor = '#0f172a',
  glow = false,
}: {
  blink: boolean;
  leftX?: number;
  rightX?: number;
  y?: number;
  eyeColor?: string;
  glow?: boolean;
}) {
  const mood = useContext(AvatarMoodContext);

  if (mood === 'laugh' || mood === 'cheer') {
    return (
      <g stroke={eyeColor} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d={`M${leftX - 6},${y + 2} Q${leftX},${y - 7} ${leftX + 6},${y + 2}`} />
        <path d={`M${rightX - 6},${y + 2} Q${rightX},${y - 7} ${rightX + 6},${y + 2}`} />
      </g>
    );
  }

  if (mood === 'cry') {
    return (
      <g stroke={eyeColor} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d={`M${leftX - 6},${y - 3} L${leftX + 5},${y + 2} L${leftX - 6},${y + 5}`} />
        <path d={`M${rightX + 6},${y - 3} L${rightX - 5},${y + 2} L${rightX + 6},${y + 5}`} />
      </g>
    );
  }

  if (mood === 'surprised') {
    return (
      <g>
        <circle cx={leftX} cy={y} r="9.5" fill="#ffffff" stroke={eyeColor} strokeWidth="1.5" />
        <circle cx={rightX} cy={y} r="9.5" fill="#ffffff" stroke={eyeColor} strokeWidth="1.5" />
        <circle cx={leftX} cy={y} r="2.8" fill={eyeColor} />
        <circle cx={rightX} cy={y} r="2.8" fill={eyeColor} />
      </g>
    );
  }

  if (blink) {
    return (
      <g stroke={eyeColor} strokeWidth="3.2" strokeLinecap="round">
        <line x1={leftX - 6} y1={y} x2={leftX + 6} y2={y} />
        <line x1={rightX - 6} y1={y} x2={rightX + 6} y2={y} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={leftX} cy={y} r="7.5" fill="#ffffff" />
      <circle cx={rightX} cy={y} r="7.5" fill="#ffffff" />
      <circle cx={leftX} cy={y} r="4.3" fill={eyeColor} />
      <circle cx={rightX} cy={y} r="4.3" fill={eyeColor} />
      <circle cx={leftX + 1.8} cy={y - 1.8} r="1.7" fill="#ffffff" />
      <circle cx={rightX + 1.8} cy={y - 1.8} r="1.7" fill="#ffffff" />
      {glow && (
        <>
          <circle cx={leftX} cy={y} r="9" fill="#22d3ee" opacity="0.22" />
          <circle cx={rightX} cy={y} r="9" fill="#22d3ee" opacity="0.22" />
        </>
      )}
    </g>
  );
}

function Mouth({
  y = 79,
  jawHeight,
  openRatio,
  fill = '#450a0a',
  tongue = '#fb7185',
}: {
  y?: number;
  jawHeight: number;
  openRatio: number;
  fill?: string;
  tongue?: string;
}) {
  const width = 16 + openRatio * 10;
  return (
    <g>
      <rect
        x={60 - width / 2}
        y={y - jawHeight / 2}
        width={width}
        height={jawHeight}
        rx={Math.min(8, jawHeight / 2 + 2)}
        fill={fill}
        stroke="#0f172a"
        strokeWidth="2.2"
      />
      {openRatio > 0.18 && (
        <ellipse
          cx={60}
          cy={y + jawHeight * 0.22}
          rx={width * 0.34}
          ry={Math.max(1.5, jawHeight * 0.25)}
          fill={tongue}
        />
      )}
      {openRatio > 0.35 && (
        <rect
          x={60 - width * 0.3}
          y={y - jawHeight / 2 + 1}
          width={width * 0.6}
          height={2.8}
          rx={1}
          fill="#ffffff"
        />
      )}
    </g>
  );
}

function renderCharacterSvg(
  id: CharacterId,
  blink: boolean,
  jawHeight: number,
  openRatio: number
) {
  switch (id) {
    case 'fox':
      return (
        <g>
          {/* Low-poly ears */}
          <polygon points="22,48 16,12 48,30" fill="#ea580c" stroke="#431407" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="24,42 20,19 42,32" fill="#fed7aa" />
          <polygon points="98,48 104,12 72,30" fill="#ea580c" stroke="#431407" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="96,42 100,19 78,32" fill="#fed7aa" />
          {/* Head polygon */}
          <polygon points="60,22 96,44 92,84 60,104 28,84 24,44" fill="#fb923c" stroke="#431407" strokeWidth="2.5" strokeLinejoin="round" />
          {/* Low-poly cheek facets */}
          <polygon points="24,44 60,64 28,84" fill="#f97316" opacity="0.7" />
          <polygon points="96,44 60,64 92,84" fill="#ea580c" opacity="0.6" />
          <polygon points="28,84 60,64 60,104" fill="#fff7ed" />
          <polygon points="92,84 60,64 60,104" fill="#ffedd5" />
          {/* Nose */}
          <polygon points="54,68 66,68 60,75" fill="#1e1b4b" />
          <Eyes blink={blink} y={53} />
          <Mouth y={84} jawHeight={jawHeight} openRatio={openRatio} />
        </g>
      );

    case 'robot':
      return (
        <g>
          {/* Antenna */}
          <line x1="60" y1="24" x2="60" y2="8" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="8" r="6" fill={openRatio > 0.25 ? '#f43f5e' : '#22d3ee'} stroke="#083344" strokeWidth="2" />
          {/* Ear bolts */}
          <rect x="13" y="48" width="12" height="24" rx="4" fill="#0284c7" stroke="#082f49" strokeWidth="2.5" />
          <rect x="95" y="48" width="12" height="24" rx="4" fill="#0284c7" stroke="#082f49" strokeWidth="2.5" />
          {/* Head chassis */}
          <rect x="23" y="24" width="74" height="76" rx="18" fill="#38bdf8" stroke="#082f49" strokeWidth="3" />
          <polygon points="23,24 97,24 85,42 35,42" fill="#7dd3fc" opacity="0.55" />
          {/* LED Visor */}
          <rect x="31" y="40" width="58" height="28" rx="10" fill="#0f172a" stroke="#0284c7" strokeWidth="2" />
          <Eyes blink={blink} leftX={45} rightX={75} y={54} eyeColor="#22d3ee" glow />
          {/* Speaker mouth grille */}
          <rect x="38" y="75" width="44" height="16" rx="6" fill="#0f172a" />
          <rect
            x={42}
            y={83 - Math.max(2, jawHeight * 0.45)}
            width="36"
            height={Math.max(4, jawHeight * 0.9)}
            rx="3"
            fill={openRatio > 0.4 ? '#facc15' : '#22d3ee'}
          />
        </g>
      );

    case 'frog':
      return (
        <g>
          {/* Big frog eye bumps */}
          <circle cx="40" cy="34" r="16" fill="#84cc16" stroke="#1a2e05" strokeWidth="2.8" />
          <circle cx="80" cy="34" r="16" fill="#84cc16" stroke="#1a2e05" strokeWidth="2.8" />
          {/* Wide head */}
          <ellipse cx="60" cy="68" rx="44" ry="34" fill="#a3e635" stroke="#1a2e05" strokeWidth="2.8" />
          <ellipse cx="60" cy="79" rx="34" ry="20" fill="#ecfccb" />
          {/* Cheeks */}
          <circle cx="28" cy="68" r="6" fill="#fb7185" opacity="0.55" />
          <circle cx="92" cy="68" r="6" fill="#fb7185" opacity="0.55" />
          <Eyes blink={blink} leftX={40} rightX={80} y={34} />
          <Mouth y={77} jawHeight={jawHeight} openRatio={openRatio} />
        </g>
      );

    case 'cat':
      return (
        <g>
          {/* Pointy cat ears */}
          <polygon points="24,50 20,14 50,32" fill="#db2777" stroke="#500724" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="27,44 24,22 44,34" fill="#fbcfe8" />
          <polygon points="96,50 100,14 70,32" fill="#db2777" stroke="#500724" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="93,44 96,22 76,34" fill="#fbcfe8" />
          {/* Head */}
          <polygon points="60,26 94,44 96,78 60,102 24,78 26,44" fill="#f472b6" stroke="#500724" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="60,26 94,44 60,60" fill="#ec4899" opacity="0.45" />
          {/* Whiskers */}
          <g stroke="#500724" strokeWidth="2" strokeLinecap="round">
            <line x1="14" y1="64" x2="32" y2="67" />
            <line x1="14" y1="73" x2="32" y2="73" />
            <line x1="106" y1="64" x2="88" y2="67" />
            <line x1="106" y1="73" x2="88" y2="73" />
          </g>
          <polygon points="55,65 65,65 60,71" fill="#fdf2f8" />
          <Eyes blink={blink} y={54} eyeColor="#311042" />
          <Mouth y={82} jawHeight={jawHeight} openRatio={openRatio} />
        </g>
      );

    case 'alien':
      return (
        <g>
          {/* Twin antennae */}
          <path d="M40,28 Q32,10 24,14" fill="none" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="24" cy="14" r="5" fill="#fde047" stroke="#064e3b" strokeWidth="2" />
          <path d="M80,28 Q88,10 96,14" fill="none" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="96" cy="14" r="5" fill="#fde047" stroke="#064e3b" strokeWidth="2" />
          {/* Sleek alien head */}
          <polygon points="60,20 96,42 86,86 60,104 34,86 24,42" fill="#34d399" stroke="#064e3b" strokeWidth="2.6" strokeLinejoin="round" />
          <polygon points="60,20 96,42 60,55" fill="#10b981" opacity="0.5" />
          {/* Third eye */}
          <circle cx="60" cy="37" r="5.5" fill="#ffffff" stroke="#064e3b" strokeWidth="1.5" />
          <circle cx="60" cy="37" r="2.8" fill="#7c3aed" />
          <Eyes blink={blink} leftX={42} rightX={78} y={57} eyeColor="#0f172a" />
          <Mouth y={83} jawHeight={jawHeight} openRatio={openRatio} fill="#064e3b" tongue="#67e8f9" />
        </g>
      );

    case 'panda':
      return (
        <g>
          {/* Round dark ears */}
          <circle cx="30" cy="30" r="13" fill="#1e1b4b" />
          <circle cx="90" cy="30" r="13" fill="#1e1b4b" />
          {/* Head */}
          <circle cx="60" cy="64" r="39" fill="#f8fafc" stroke="#1e1b4b" strokeWidth="3" />
          {/* Rocker headband */}
          <path d="M23,46 Q60,36 97,46" fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round" />
          {/* Eye patches */}
          <ellipse cx="42" cy="58" rx="12" ry="10" transform="rotate(-18 42 58)" fill="#1e1b4b" />
          <ellipse cx="78" cy="58" rx="12" ry="10" transform="rotate(18 78 58)" fill="#1e1b4b" />
          <Eyes blink={blink} leftX={43} rightX={77} y={58} eyeColor="#6366f1" />
          <ellipse cx="60" cy="70" rx="6" ry="4" fill="#1e1b4b" />
          <Mouth y={84} jawHeight={jawHeight} openRatio={openRatio} />
        </g>
      );

    case 'owl':
      return (
        <g>
          {/* Feather tufts */}
          <polygon points="24,42 18,16 44,30" fill="#1d4ed8" stroke="#172554" strokeWidth="2.5" />
          <polygon points="96,42 102,16 76,30" fill="#1d4ed8" stroke="#172554" strokeWidth="2.5" />
          {/* Body/Head */}
          <polygon points="60,22 94,40 96,82 60,104 24,82 26,40" fill="#3b82f6" stroke="#172554" strokeWidth="2.8" strokeLinejoin="round" />
          {/* Eye mask */}
          <circle cx="43" cy="55" r="15" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
          <circle cx="77" cy="55" r="15" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
          <Eyes blink={blink} leftX={43} rightX={77} y={55} eyeColor="#1e3a8a" />
          {/* Beak */}
          <polygon points="53,64 67,64 60,76" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
          <Mouth y={83} jawHeight={jawHeight} openRatio={openRatio} fill="#78350f" tongue="#fbbf24" />
        </g>
      );

    case 'dino':
      return (
        <g>
          {/* Spikes */}
          <polygon points="44,24 52,8 60,22" fill="#fbbf24" stroke="#4c0519" strokeWidth="2" />
          <polygon points="60,22 68,6 76,24" fill="#fbbf24" stroke="#4c0519" strokeWidth="2" />
          {/* Dino head */}
          <polygon points="32,24 88,24 98,54 90,94 60,104 30,94 22,54" fill="#fb7185" stroke="#4c0519" strokeWidth="2.8" strokeLinejoin="round" />
          <polygon points="32,24 88,24 60,46" fill="#f43f5e" opacity="0.55" />
          {/* Belly/jaw accent */}
          <polygon points="34,76 86,76 80,96 60,104 40,96" fill="#ffe4e6" />
          <Eyes blink={blink} leftX={42} rightX={78} y={51} />
          <Mouth y={83} jawHeight={jawHeight} openRatio={openRatio} />
        </g>
      );

    case 'bear':
      return (
        <g>
          {/* Round ears */}
          <circle cx="28" cy="30" r="13" fill="#d97706" stroke="#451a03" strokeWidth="2.5" />
          <circle cx="28" cy="30" r="6" fill="#fde68a" />
          <circle cx="92" cy="30" r="13" fill="#d97706" stroke="#451a03" strokeWidth="2.5" />
          <circle cx="92" cy="30" r="6" fill="#fde68a" />
          {/* DJ Headphones arc */}
          <path d="M18,56 A42,42 0 0,1 102,56" fill="none" stroke="#1e293b" strokeWidth="6" />
          <rect x="12" y="48" width="12" height="24" rx="5" fill="#ec4899" stroke="#0f172a" strokeWidth="2" />
          <rect x="96" y="48" width="12" height="24" rx="5" fill="#ec4899" stroke="#0f172a" strokeWidth="2" />
          {/* Head */}
          <circle cx="60" cy="64" r="38" fill="#fbbf24" stroke="#451a03" strokeWidth="2.8" />
          <ellipse cx="60" cy="76" rx="22" ry="18" fill="#fef3c7" />
          <ellipse cx="60" cy="68" rx="7" ry="5" fill="#451a03" />
          <Eyes blink={blink} y={54} />
          <Mouth y={83} jawHeight={jawHeight} openRatio={openRatio} />
        </g>
      );

    case 'octopus':
      return (
        <g>
          {/* Tentacle base */}
          <circle cx="32" cy="94" r="9" fill="#c026d3" stroke="#4a044e" strokeWidth="2" />
          <circle cx="48" cy="99" r="9" fill="#d946ef" stroke="#4a044e" strokeWidth="2" />
          <circle cx="72" cy="99" r="9" fill="#d946ef" stroke="#4a044e" strokeWidth="2" />
          <circle cx="88" cy="94" r="9" fill="#c026d3" stroke="#4a044e" strokeWidth="2" />
          {/* Bulbous head */}
          <ellipse cx="60" cy="56" rx="38" ry="38" fill="#e879f9" stroke="#4a044e" strokeWidth="2.8" />
          <ellipse cx="46" cy="34" rx="10" ry="6" transform="rotate(-20 46 34)" fill="#fae8ff" opacity="0.5" />
          <Eyes blink={blink} y={55} eyeColor="#3b0764" />
          <Mouth y={79} jawHeight={jawHeight} openRatio={openRatio} fill="#4a044e" tongue="#f472b6" />
        </g>
      );

    case 'capybara':
      return (
        <g>
          {/* Little round ears */}
          <ellipse cx="26" cy="40" rx="8" ry="10" transform="rotate(-20 26 40)" fill="#92400e" stroke="#451a03" strokeWidth="2.4" />
          <ellipse cx="94" cy="40" rx="8" ry="10" transform="rotate(20 94 40)" fill="#92400e" stroke="#451a03" strokeWidth="2.4" />
          {/* Chill block-ish low-poly capybara head */}
          <polygon points="30,32 90,32 98,64 88,98 32,98 22,64" fill="#d97706" stroke="#451a03" strokeWidth="2.6" strokeLinejoin="round" />
          <polygon points="30,32 90,32 60,52" fill="#f59e0b" opacity="0.45" />
          {/* Snout */}
          <ellipse cx="60" cy="70" rx="26" ry="18" fill="#b45309" />
          <ellipse cx="52" cy="64" rx="3.2" ry="2.2" fill="#451a03" />
          <ellipse cx="68" cy="64" rx="3.2" ry="2.2" fill="#451a03" />
          {/* Iconic tangerine on head */}
          <circle cx="60" cy="21" r="11" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" />
          <ellipse cx="64" cy="10" rx="5" ry="3" transform="rotate(-20 64 10)" fill="#4ade80" stroke="#14532d" strokeWidth="1.2" />
          <Eyes blink={blink} leftX={40} rightX={80} y={50} eyeColor="#291509" />
          <Mouth y={83} jawHeight={jawHeight} openRatio={openRatio} fill="#451a03" tongue="#fb7185" />
        </g>
      );

    case 'shrek':
      return (
        <g>
          {/* Iconic Shrek trumpet ears */}
          <path d="M25,44 L10,32 L12,24 L28,36 Z" fill="#84cc16" stroke="#365314" strokeWidth="2.5" strokeLinejoin="round" />
          <ellipse cx="10" cy="28" rx="4" ry="6" transform="rotate(-25 10 28)" fill="#65a30d" stroke="#365314" strokeWidth="2" />
          <path d="M95,44 L110,32 L108,24 L92,36 Z" fill="#84cc16" stroke="#365314" strokeWidth="2.5" strokeLinejoin="round" />
          <ellipse cx="110" cy="28" rx="4" ry="6" transform="rotate(25 110 28)" fill="#65a30d" stroke="#365314" strokeWidth="2" />
          {/* Big ogre head */}
          <ellipse cx="60" cy="60" rx="37" ry="42" fill="#a3e635" stroke="#365314" strokeWidth="2.8" />
          <path d="M28,44 Q60,36 92,44" stroke="#4d7c0f" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {/* Vest collar at bottom */}
          <polygon points="32,96 60,88 88,96 82,108 38,108" fill="#78350f" stroke="#451a03" strokeWidth="2" />
          {/* Big ogre nose */}
          <ellipse cx="60" cy="64" rx="11" ry="8" fill="#84cc16" stroke="#4d7c0f" strokeWidth="2" />
          <circle cx="55" cy="65" r="2.2" fill="#365314" />
          <circle cx="65" cy="65" r="2.2" fill="#365314" />
          <Eyes blink={blink} leftX={42} rightX={78} y={50} eyeColor="#3f2305" />
          <Mouth y={81} jawHeight={jawHeight} openRatio={openRatio} fill="#450a0a" tongue="#fb7185" />
        </g>
      );

    case 'ershik':
      return (
        <g>
          {/* Plastic handle at the bottom */}
          <rect x="52" y="88" width="16" height="24" rx="6" fill="#06b6d4" stroke="#083344" strokeWidth="2.5" />
          <rect x="46" y="84" width="28" height="8" rx="4" fill="#22d3ee" stroke="#083344" strokeWidth="2" />
          {/* Fluffy spiky brush bristles (low-poly starburst) */}
          <polygon
            points="60,10 71,21 86,14 88,29 103,34 96,49 106,63 92,72 94,85 78,84 60,90 42,84 26,85 28,72 14,63 24,49 17,34 32,29 34,14 49,21"
            fill="#f8fafc"
            stroke="#0e7490"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          {/* Blue bristle stripes */}
          <polygon points="60,16 68,26 52,26" fill="#38bdf8" opacity="0.7" />
          <polygon points="24,48 34,42 34,54" fill="#38bdf8" opacity="0.7" />
          <polygon points="96,48 86,42 86,54" fill="#38bdf8" opacity="0.7" />
          {/* Googly eyes & funny mouth */}
          <Eyes blink={blink} leftX={45} rightX={75} y={48} eyeColor="#0f172a" />
          <Mouth y={70} jawHeight={jawHeight} openRatio={openRatio} fill="#083344" tongue="#f472b6" />
        </g>
      );

    case 'cyborg':
    default:
      return (
        <g>
          {/* Cyber side fins */}
          <polygon points="16,44 26,36 26,76 16,68" fill="#0284c7" stroke="#082f49" strokeWidth="2" />
          <polygon points="104,44 94,36 94,76 104,68" fill="#0284c7" stroke="#082f49" strokeWidth="2" />
          {/* Chrome-blue head */}
          <polygon points="60,20 94,36 94,82 60,104 26,82 26,36" fill="#cbd5e1" stroke="#0f172a" strokeWidth="2.8" strokeLinejoin="round" />
          {/* Cyber half-plate */}
          <polygon points="60,20 94,36 94,82 60,104" fill="#38bdf8" opacity="0.55" />
          {/* Laser Visor strip */}
          <rect x="30" y="44" width="60" height="20" rx="8" fill="#0f172a" stroke="#0284c7" strokeWidth="2" />
          {!blink && (
            <rect x="38" y="51" width="44" height="6" rx="3" fill={openRatio > 0.35 ? '#f43f5e' : '#22d3ee'} />
          )}
          <Mouth y={82} jawHeight={jawHeight} openRatio={openRatio} fill="#0f172a" tongue="#38bdf8" />
        </g>
      );
  }
}
