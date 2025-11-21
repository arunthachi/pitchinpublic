'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SidebarNav } from '@/components/SidebarNav';
import { FullScreenVideoFeed } from '@/components/FullScreenVideoFeed';
import { RecordingStudio } from '@/components/RecordingStudio';
import { FloatingReactions } from '@/components/FloatingReactions';
import { UserProfile } from '@/components/UserProfile';
import { mockPitches, mockUser } from '@/lib/data';
import { Pitch } from '@/types';

export default function Home() {
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<Pitch>(mockPitches[0]);
  const [handlers, setHandlers] = useState<{
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onShare: () => void;
  } | null>(null);

  // Filter user's own pitches (in production, fetch from API by user ID)
  const userPitches = mockPitches.filter((pitch) =>
    pitch.founderName === mockUser.name // Mock: would match mockUser.id in production
  );

  const handlePitchChange = useCallback((pitch: Pitch, newHandlers: typeof handlers) => {
    setCurrentPitch(pitch);
    setHandlers(newHandlers);
  }, []);

  return (
    <div className="flex min-h-screen bg-black">
      {/* Left Sidebar Navigation - Hidden on mobile */}
      <div className="hidden lg:block">
        <SidebarNav onPostClick={() => setRecordingStudioOpen(true)} />
      </div>

      {/* Mobile Bottom Nav (Post button) */}
      <button
        onClick={() => setRecordingStudioOpen(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-neon-cyan to-lime-green flex items-center justify-center shadow-lg"
      >
        <svg className="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Profile Button - Top Right */}
      <button
        onClick={() => setProfileOpen(true)}
        className="fixed top-4 right-4 z-50 w-10 h-10 lg:w-11 lg:h-11 rounded-full border-2 border-slate-700 hover:border-neon-cyan transition-all overflow-hidden group"
      >
        <img
          src={mockUser.avatar}
          alt={mockUser.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
        />
      </button>

      {/* Main Content Area - Video Feed */}
      <main className="flex-1 lg:ml-64 flex items-center justify-center bg-black">
        {/* Desktop: Centered with reactions on side */}
        <div className="hidden lg:flex items-end gap-3 py-4">
          {/* Video Feed Container - Phone aspect ratio */}
          <div className="relative h-[calc(100vh-4rem)] w-auto aspect-[9/16] max-h-[calc(100vh-4rem)] bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            <FullScreenVideoFeed
              pitches={mockPitches}
              hideReactions={true}
              onCurrentPitchChange={handlePitchChange}
            />
          </div>

          {/* Reactions - Outside video (desktop only) */}
          {handlers && (
            <FloatingReactions
              pitch={currentPitch}
              onRoast={handlers.onRoast}
              onToast={handlers.onToast}
              onOpenFeedback={handlers.onOpenFeedback}
              onShare={handlers.onShare}
            />
          )}
        </div>

        {/* Mobile: Full screen like TikTok */}
        <div className="lg:hidden w-full h-screen">
          <FullScreenVideoFeed
            pitches={mockPitches}
            hideReactions={false}
            onCurrentPitchChange={handlePitchChange}
          />
        </div>
      </main>

      {/* Recording Studio Modal */}
      <RecordingStudio
        isOpen={recordingStudioOpen}
        onClose={() => setRecordingStudioOpen(false)}
      />

      {/* User Profile Panel */}
      <UserProfile
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={mockUser}
        userPitches={userPitches}
      />

      {/* Swipe Instruction (shows briefly on first load) */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 3, duration: 1 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      >
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
          <p className="text-xs text-white font-body">
            Swipe up/down or use arrow keys
          </p>
        </div>
      </motion.div>
    </div>
  );
}
