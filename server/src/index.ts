import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { ensureBuiltInMemeAudio } from './audioGenerator.js';
import { BUILT_IN_MEMES } from './memes.js';
import { RoomManager } from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_ROOT = path.resolve(__dirname, '..');
const MEMES_DIR = path.join(SERVER_ROOT, 'public', 'memes');
const CLIENT_DIST_DIR = path.resolve(SERVER_ROOT, '..', 'client', 'dist');

ensureBuiltInMemeAudio(MEMES_DIR);

const rawCors = process.env.CORS_ORIGIN || '*';
const corsOrigin =
  rawCors === '*'
    ? '*'
    : rawCors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const app = express();
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 12 * 1024 * 1024,
});

const roomManager = new RoomManager(io);

app.use(
  '/memes',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(MEMES_DIR)
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, memesCount: BUILT_IN_MEMES.length });
});

app.get('/api/memes', (_req, res) => {
  res.json({ memes: BUILT_IN_MEMES });
});

app.get('/api/ram-meme/:code/:memeId', (req, res) => {
  const { code, memeId } = req.params;
  const entry = roomManager.getRamMeme(code, memeId);
  if (!entry) {
    res.status(404).json({ error: 'Медиа не найдено или комната закрыта.' });
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', entry.mimeType);
  res.setHeader('Content-Length', String(entry.buffer.length));
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(entry.buffer);
});

io.on('connection', (socket) => {
  socket.on('create_room', (payload, cb) => {
    const result = roomManager.createRoom(socket.id, payload || {});
    if (result.ok) socket.join(result.room.code);
    cb?.(result);
  });

  socket.on('join_room', (payload, cb) => {
    const result = roomManager.joinRoom(socket.id, payload || {});
    if (result.ok) socket.join(result.room.code);
    cb?.(result);
  });

  socket.on('leave_room', () => {
    const sess = roomManager.getSocketSession(socket.id);
    if (sess) socket.leave(sess.code);
    roomManager.leaveRoom(socket.id);
  });

  socket.on('select_character', ({ characterId }, cb) => {
    const res = roomManager.selectCharacter(socket.id, characterId);
    cb?.(res);
  });

  socket.on('toggle_ready', () => roomManager.toggleReady(socket.id));

  socket.on('update_settings', (partial) => roomManager.updateSettings(socket.id, partial || {}));

  socket.on('toggle_pack_meme', ({ memeId }) => {
    if (memeId) roomManager.togglePackMeme(socket.id, memeId);
  });

  socket.on('add_custom_meme', (payload, cb) => {
    try {
      const rawBuf = payload?.buffer;
      const buf = Buffer.isBuffer(rawBuf)
        ? rawBuf
        : rawBuf instanceof ArrayBuffer || ArrayBuffer.isView(rawBuf)
        ? Buffer.from(rawBuf as ArrayBuffer)
        : null;
      if (!buf) {
        cb?.({ ok: false, error: 'Некорректный буфер файла.' });
        return;
      }
      const res = roomManager.addCustomMemeInRam(socket.id, {
        title: payload.title,
        promptHint: payload.promptHint,
        emoji: payload.emoji,
        type: payload.type === 'video' ? 'video' : 'audio',
        mimeType: payload.mimeType,
        duration: payload.duration,
        buffer: buf,
      });
      cb?.(res);
    } catch (err) {
      console.error('add_custom_meme error:', err);
      cb?.({ ok: false, error: 'Ошибка добавления мема.' });
    }
  });

  socket.on('remove_custom_meme', ({ memeId }) => {
    if (memeId) roomManager.removeCustomMeme(socket.id, memeId);
  });

  socket.on('start_game', () => roomManager.startGame(socket.id));

  socket.on('submit_recording', (payload, cb) => {
    try {
      const rawBuf = payload?.buffer;
      const buf = Buffer.isBuffer(rawBuf)
        ? rawBuf
        : rawBuf instanceof ArrayBuffer || ArrayBuffer.isView(rawBuf)
        ? Buffer.from(rawBuf as ArrayBuffer)
        : null;
      if (!buf) {
        cb?.({ ok: false, error: 'Пустая запись.' });
        return;
      }
      roomManager.submitRecordingInRam(socket.id, {
        buffer: buf,
        mimeType: payload.mimeType || 'audio/webm;codecs=opus',
        duration: payload.duration || 0,
        analysis: payload.analysis,
      });
      cb?.({ ok: true });
    } catch (err) {
      console.error('submit_recording error:', err);
      cb?.({ ok: false, error: 'Ошибка сохранения аудио.' });
    }
  });

  socket.on('skip_recording', () => roomManager.skipRecording(socket.id));

  socket.on('gallery_clip_ended', () => roomManager.galleryClipEnded(socket.id));

  socket.on('send_reaction', (payload) => {
    roomManager.sendReaction(socket.id, payload || { emoji: '🔥', targetPlayerId: null });
  });

  socket.on('play_again', () => roomManager.playAgain(socket.id));

  // WebRTC Mesh Voice Chat Signaling
  socket.on('webrtc_offer', ({ targetPlayerId, sdp }) => {
    const target = roomManager.getTargetSocketInRoom(socket.id, targetPlayerId);
    if (target) {
      io.to(target.socketId).emit('webrtc_offer', {
        fromPlayerId: target.fromPlayerId,
        sdp,
      });
    }
  });

  socket.on('webrtc_answer', ({ targetPlayerId, sdp }) => {
    const target = roomManager.getTargetSocketInRoom(socket.id, targetPlayerId);
    if (target) {
      io.to(target.socketId).emit('webrtc_answer', {
        fromPlayerId: target.fromPlayerId,
        sdp,
      });
    }
  });

  socket.on('webrtc_ice_candidate', ({ targetPlayerId, candidate }) => {
    const target = roomManager.getTargetSocketInRoom(socket.id, targetPlayerId);
    if (target) {
      io.to(target.socketId).emit('webrtc_ice_candidate', {
        fromPlayerId: target.fromPlayerId,
        candidate,
      });
    }
  });

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎤 Mimic Voice Party Server running on port ${PORT}`);
});
