import React from 'react';
import { motion } from 'framer-motion';

interface MemoryItem {
  src: string;
  caption: string;
  rotate: number;
  top: string;
  sideOffset: string;
  side: 'left' | 'right';
}

const DESKTOP_MEMORIES: MemoryItem[] = [
  {
    src: '/memories/m2.webp',
    caption: 'Всем кууу😸',
    rotate: -7,
    top: '6%',
    sideOffset: '2.2%',
    side: 'left',
  },
  {
    src: '/memories/m9.jpg',
    caption: 'Сладкие😋',
    rotate: 6,
    top: '29%',
    sideOffset: '3.2%',
    side: 'left',
  },
  {
    src: '/memories/m8.jpg',
    caption: 'Банда🤘',
    rotate: -4,
    top: '52%',
    sideOffset: '1.8%',
    side: 'left',
  },
  {
    src: '/memories/m5.jpg',
    caption: 'Слиппи😴',
    rotate: 5,
    top: '74%',
    sideOffset: '2.8%',
    side: 'left',
  },
  {
    src: '/memories/m3.jpg',
    caption: 'Диима давай в амогусс ✨',
    rotate: 7,
    top: '11%',
    sideOffset: '2.5%',
    side: 'right',
  },
  {
    src: '/memories/m6.jpg',
    caption: 'Комфортик🤗',
    rotate: -6,
    top: '42%',
    sideOffset: '1.8%',
    side: 'right',
  },
  {
    src: '/memories/m4.jpg',
    caption: 'Самые pesdatye😎',
    rotate: 6,
    top: '71%',
    sideOffset: '3%',
    side: 'right',
  },
];

export const FriendsMemoryBackdrop: React.FC<{ subtle?: boolean }> = ({ subtle = false }) => {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 hidden xl:block overflow-hidden transition-opacity duration-500 ${
        subtle ? 'opacity-25' : 'opacity-75'
      }`}
      aria-hidden="true"
    >
      {DESKTOP_MEMORIES.map((item, idx) => (
        <motion.div
          key={item.src}
          initial={{ opacity: 0, scale: 0.9, rotate: item.rotate }}
          animate={{
            opacity: 1,
            scale: 1,
            y: [0, idx % 2 === 0 ? -8 : 8, 0],
            rotate: [item.rotate, item.rotate + (idx % 2 === 0 ? 1.5 : -1.5), item.rotate],
          }}
          transition={{
            opacity: { duration: 0.6, delay: idx * 0.08 },
            y: { duration: 5.5 + idx * 0.6, repeat: Infinity, ease: 'easeInOut' },
            rotate: { duration: 6.5 + idx * 0.5, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute w-44 rounded-2xl bg-white/95 p-2 pb-3 shadow-[0_20px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/40"
          style={{
            top: item.top,
            [item.side]: item.sideOffset,
          }}
        >
          {/* Decorative tape strip */}
          <div className="mx-auto -mt-3.5 mb-1.5 h-3 w-12 rounded-sm bg-amber-200/80 shadow-sm" />
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
            <img
              src={item.src}
              alt={item.caption}
              className="h-full w-full object-cover contrast-105 saturate-115"
              loading="lazy"
            />
          </div>
          <div className="mt-1.5 text-center font-display text-xs font-bold text-slate-800">
            {item.caption}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export const FriendsMobileStrip: React.FC = () => {
  const mobilePhotos = [
    { src: '/memories/m2.webp', caption: 'Всем кууу😸' },
    { src: '/memories/m9.jpg', caption: 'Сладкие😋' },
    { src: '/memories/m3.jpg', caption: 'Амогусс ✨' },
    { src: '/memories/m8.jpg', caption: 'Банда🤘' },
    { src: '/memories/m5.jpg', caption: 'Слиппи😴' },
  ];

  return (
    <div className="xl:hidden mt-4 flex flex-wrap items-center justify-center gap-2 px-2">
      {mobilePhotos.map((p, idx) => (
        <div
          key={p.src}
          className="w-18 rounded-xl bg-white/90 p-1 pb-1.5 shadow-lg"
          style={{ transform: `rotate(${idx % 2 === 0 ? -4 : 4}deg)` }}
        >
          <img
            src={p.src}
            alt={p.caption}
            className="h-12 w-14 rounded-lg object-cover contrast-105 saturate-115"
            loading="lazy"
          />
          <div className="mt-0.5 text-center text-[9px] font-extrabold text-slate-800">
            {p.caption}
          </div>
        </div>
      ))}
    </div>
  );
};
