import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Trash2, Music, Sparkles, CheckCircle2 } from 'lucide-react';
import { MemeItem } from '../types/game';
import { decodeAndNormalizeAudio, encodeAudioBufferToWavBlob } from '../utils/voiceSimilarityAnalyzer';
import { soundFx } from '../utils/soundFx';

interface MemePackModalProps {
  isOpen: boolean;
  onClose: () => void;
  customMemes: MemeItem[];
  isHost: boolean;
  onAddCustomMeme: (payload: {
    title: string;
    promptHint?: string;
    emoji?: string;
    type: 'audio' | 'video';
    mimeType: string;
    duration: number;
    buffer: ArrayBuffer;
  }) => Promise<{ ok: boolean; meme?: MemeItem; error?: string }>;
  onRemoveCustomMeme: (memeId: string) => void;
}

const PACK_EMOJIS = ['🎵', '🔥', '😂', '😱', '🐶', '💥', '🎬', '👻'];

export const MemePackModal: React.FC<MemePackModalProps> = ({
  isOpen,
  onClose,
  customMemes,
  isHost,
  onAddCustomMeme,
  onRemoveCustomMeme,
}) => {
  const [title, setTitle] = useState('');
  const [promptHint, setPromptHint] = useState('');
  const [emoji, setEmoji] = useState('🎵');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);

    let added = 0;
    try {
      for (const file of files) {
        setStatusMsg(`Обработка «${file.name}»...`);
        const isVideo =
          file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);

        // Extract and normalize audio track (up to 15s) so ALL features (Waveform Overlay + WebAudio similarity) work!
        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await decodeAndNormalizeAudio(file);
        } catch {
          setErrorMsg(`Не удалось декодировать аудиодорожку из «${file.name}».`);
          continue;
        }

        const duration = Math.min(15, Math.max(0.8, audioBuffer.duration));
        let sendBuffer: ArrayBuffer;
        let sendMime: string;
        let sendType: 'audio' | 'video' = 'audio';

        // If it's a compact video <= 4.5 MB and <= 15s, send original video so players see video too!
        if (isVideo && file.size <= 4.5 * 1024 * 1024 && duration <= 15.5) {
          sendBuffer = await file.arrayBuffer();
          sendMime = file.type || 'video/mp4';
          sendType = 'video';
        } else {
          // Encode clean <=15s WAV in memory (~150-450 KB)
          const wavBlob = encodeAudioBufferToWavBlob(audioBuffer, 15);
          sendBuffer = await wavBlob.arrayBuffer();
          sendMime = 'audio/wav';
          sendType = 'audio';
        }

        const finalTitle =
          files.length === 1 && title.trim()
            ? title.trim()
            : file.name.replace(/\.[^.]+$/, '').slice(0, 36);

        const res = await onAddCustomMeme({
          title: finalTitle,
          promptHint: promptHint.trim() || undefined,
          emoji,
          type: sendType,
          mimeType: sendMime,
          duration: Number(duration.toFixed(1)),
          buffer: sendBuffer,
        });

        if (res.ok) {
          added++;
        } else {
          setErrorMsg(res.error || 'Ошибка загрузки.');
        }
      }

      if (added > 0) {
        soundFx.pop();
        setTitle('');
        setPromptHint('');
        setStatusMsg(`Добавлено в пак: ${added} шт.!`);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card w-full max-w-xl rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-xl font-black text-white">Свой пак мемов</h3>
              <p className="text-xs text-white/60">
                Загрузи MP3, WAV, OGG или MP4/WebM (авто-обрезка до 15 сек)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              maxLength={36}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название мема (или имя файла)"
              className="rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
            />
            <input
              type="text"
              maxLength={80}
              value={promptHint}
              onChange={(e) => setPromptHint(e.target.value)}
              placeholder="Подсказка (как озвучивать)"
              className="rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {PACK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`h-8 w-8 rounded-lg text-lg transition ${
                    emoji === em ? 'bg-cyan-400 text-slate-950 scale-110' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept="audio/*,video/mp4,video/webm,.mp3,.wav,.ogg,.m4a,.mp4,.webm"
              onChange={handleFiles}
              className="hidden"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="party-btn-cyan text-sm px-4 py-2"
            >
              <Upload className="h-4 w-4" />
              <span>{busy ? 'Обработка...' : 'Выбрать файлы (можно несколько)'}</span>
            </button>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>{statusMsg}</span>
            </div>
          )}
          {errorMsg && <div className="text-xs font-bold text-rose-300">{errorMsg}</div>}
        </div>

        {/* Current Custom Pack List */}
        <div className="space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>В паке комнаты ({customMemes.length})</span>
          </div>

          {customMemes.length === 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center text-xs text-white/50">
              Пока пусто — добавь свои звуки или кружочки/видео, и они появятся у всех игроков!
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {customMemes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 border border-white/10 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl">{m.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">{m.title}</div>
                      <div className="text-[11px] text-white/55">
                        {m.duration.toFixed(1)}с • от {m.uploadedBy}
                      </div>
                    </div>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => onRemoveCustomMeme(m.id)}
                      className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/20 transition"
                      title="Удалить из пака"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
