import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, VolumeX, LogOut, Trophy } from 'lucide-react';
import { MediaStreamProvider } from './contexts/MediaStreamContext';
import { WebRtcVoiceProvider } from './contexts/WebRtcVoiceContext';
import { useSocket } from './hooks/useSocket';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { DemonstrationPhase } from './components/DemonstrationPhase';
import { RecordingPhase } from './components/RecordingPhase';
import { GalleryPhase } from './components/GalleryPhase';
import { RoundResultsScreen } from './components/RoundResultsScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { FloatingReactions } from './components/FloatingReactions';
import { VoiceChatBar } from './components/VoiceChatBar';
import { soundFx } from './utils/soundFx';

function GameShell() {
  const {
    socket,
    connected,
    room,
    me,
    playerId,
    error,
    clearError,
    reactions,
    recordingMedia,
    createRoom,
    joinRoom,
    leaveRoom,
    selectCharacter,
    toggleReady,
    updateSettings,
    togglePackMeme,
    startGame,
    addCustomMeme,
    removeCustomMeme,
    submitRecording,
    skipRecording,
    galleryClipEnded,
    sendReaction,
    playAgain,
  } = useSocket();

  const [sfxMuted, setSfxMuted] = useState(false);

  const toggleMute = () => {
    const next = !sfxMuted;
    soundFx.muted = next;
    setSfxMuted(next);
  };

  const phaseKey = room && me ? `${room.code}-${room.phase}-${room.currentRound}` : 'home';

  return (
    <WebRtcVoiceProvider socket={socket} room={room} myPlayerId={playerId}>
      <div className="relative min-h-[100dvh] w-full overflow-x-hidden flex flex-col">
        {/* Ambient Party Lights */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-24 -left-24 h-80 w-80 sm:h-96 sm:w-96 rounded-full bg-fuchsia-600/25 blur-[110px]" />
          <div className="absolute top-1/3 -right-24 h-80 w-80 sm:h-96 sm:w-96 rounded-full bg-cyan-500/20 blur-[110px]" />
          <div className="absolute -bottom-24 left-1/3 h-80 w-80 sm:h-96 sm:w-96 rounded-full bg-amber-500/15 blur-[120px]" />
        </div>

        <FloatingReactions reactions={reactions} />

        {/* Mobile-First Top Bar inside active room */}
        {room && me && (
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#130a2f]/85 backdrop-blur-lg">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 sm:px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-base sm:text-xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent truncate">
                  MIMIC
                </span>
                <span className="rounded-lg bg-white/10 px-2 py-0.5 font-display text-[11px] font-bold tracking-widest text-cyan-200 shrink-0">
                  #{room.code}
                </span>
                {room.phase !== 'lobby' && room.currentRound > 0 && (
                  <span className="hidden sm:inline-flex rounded-full bg-fuchsia-500/20 border border-fuchsia-400/35 px-2.5 py-0.5 text-xs font-bold text-fuchsia-200">
                    Р.{room.currentRound}/{room.settings.totalRounds}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <VoiceChatBar />

                <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 text-xs font-black text-amber-300">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>{me.score}</span>
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  title={sfxMuted ? 'Включить звуки интерфейса' : 'Отключить звуки интерфейса'}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition"
                >
                  {sfxMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                {room.phase !== 'lobby' && (
                  <button
                    type="button"
                    onClick={leaveRoom}
                    title="Выйти из комнаты"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Main Animated View */}
        <main className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={phaseKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {!room || !me ? (
                <HomeScreen
                  connected={connected}
                  error={error}
                  onClearError={clearError}
                  onCreateRoom={createRoom}
                  onJoinRoom={joinRoom}
                />
              ) : room.phase === 'lobby' ? (
                <LobbyScreen
                  room={room}
                  me={me}
                  onSelectCharacter={selectCharacter}
                  onToggleReady={toggleReady}
                  onUpdateSettings={updateSettings}
                  onTogglePackMeme={togglePackMeme}
                  onStartGame={startGame}
                  onLeaveRoom={leaveRoom}
                  onAddCustomMeme={addCustomMeme}
                  onRemoveCustomMeme={removeCustomMeme}
                />
              ) : room.phase === 'demonstration' ? (
                <DemonstrationPhase room={room} me={me} />
              ) : room.phase === 'recording' ? (
                <RecordingPhase
                  room={room}
                  me={me}
                  onSubmitRecording={submitRecording}
                  onSkipRecording={skipRecording}
                />
              ) : room.phase === 'gallery' ? (
                <GalleryPhase
                  room={room}
                  me={me}
                  recordingMedia={recordingMedia}
                  onClipEnded={galleryClipEnded}
                  onSendReaction={sendReaction}
                />
              ) : room.phase === 'round_results' ? (
                <RoundResultsScreen room={room} me={me} />
              ) : (
                <GameOverScreen
                  room={room}
                  me={me}
                  onPlayAgain={playAgain}
                  onLeaveRoom={leaveRoom}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </WebRtcVoiceProvider>
  );
}

export function App() {
  return (
    <MediaStreamProvider>
      <GameShell />
    </MediaStreamProvider>
  );
}

export default App;
