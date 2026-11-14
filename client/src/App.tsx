import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, VolumeX, LogOut, Trophy } from 'lucide-react';
import { useSocket } from './hooks/useSocket';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { ContentSelectPhase } from './components/ContentSelectPhase';
import { DemonstrationPhase } from './components/DemonstrationPhase';
import { RecordingPhase } from './components/RecordingPhase';
import { GalleryPhase } from './components/GalleryPhase';
import { ScoringPhase } from './components/ScoringPhase';
import { RoundResultsScreen } from './components/RoundResultsScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { FloatingReactions } from './components/FloatingReactions';
import { soundFx } from './utils/soundFx';

export function App() {
  const {
    connected,
    room,
    me,
    error,
    clearError,
    reactions,
    recordingMedia,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    updateSettings,
    startGame,
    addCustomMeme,
    removeCustomMeme,
    selectMeme,
    advanceFromDemo,
    submitRecording,
    skipRecording,
    forceFinishRecording,
    galleryNavigate,
    sendReaction,
    advanceToResults,
    nextRound,
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
    <div className="relative min-h-screen flex flex-col">
      {/* Ambient Party Lights */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute -bottom-24 left-1/3 h-96 w-96 rounded-full bg-amber-500/15 blur-[130px]" />
      </div>

      <FloatingReactions reactions={reactions} />

      {/* Clean Top Bar inside active room */}
      {room && me && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#130a2f]/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="font-display text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                MIMIC PARTY
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-0.5 font-display text-xs font-bold tracking-widest text-cyan-200">
                #{room.code}
              </span>
              {room.phase !== 'lobby' && room.currentRound > 0 && (
                <span className="hidden sm:inline-flex rounded-full bg-fuchsia-500/20 border border-fuchsia-400/35 px-3 py-0.5 text-xs font-bold text-fuchsia-200">
                  Раунд {room.currentRound}/{room.settings.totalRounds}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1 text-xs font-black text-amber-300">
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

      {/* Smooth Framer Motion Phase Transitions */}
      <main className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
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
                onToggleReady={toggleReady}
                onUpdateSettings={updateSettings}
                onStartGame={startGame}
                onLeaveRoom={leaveRoom}
                onAddCustomMeme={addCustomMeme}
                onRemoveCustomMeme={removeCustomMeme}
              />
            ) : room.phase === 'content_select' ? (
              <ContentSelectPhase
                room={room}
                me={me}
                onSelectMeme={selectMeme}
                onAddCustomMeme={addCustomMeme}
                onRemoveCustomMeme={removeCustomMeme}
              />
            ) : room.phase === 'demonstration' ? (
              <DemonstrationPhase
                room={room}
                me={me}
                onAdvanceFromDemo={advanceFromDemo}
              />
            ) : room.phase === 'recording' ? (
              <RecordingPhase
                room={room}
                me={me}
                onSubmitRecording={submitRecording}
                onSkipRecording={skipRecording}
                onForceFinish={forceFinishRecording}
              />
            ) : room.phase === 'gallery' ? (
              <GalleryPhase
                room={room}
                me={me}
                recordingMedia={recordingMedia}
                onGalleryNavigate={galleryNavigate}
                onSendReaction={sendReaction}
              />
            ) : room.phase === 'scoring' ? (
              <ScoringPhase
                room={room}
                me={me}
                recordingMedia={recordingMedia}
                onSendReaction={sendReaction}
                onAdvanceToResults={advanceToResults}
              />
            ) : room.phase === 'round_results' ? (
              <RoundResultsScreen room={room} me={me} onNextRound={nextRound} />
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
  );
}

export default App;
