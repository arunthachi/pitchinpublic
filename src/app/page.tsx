'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SidebarNav } from '@/components/SidebarNav';
import { FullScreenVideoFeed } from '@/components/FullScreenVideoFeed';
import { RecordingStudio } from '@/components/RecordingStudio';
import { FloatingReactions } from '@/components/FloatingReactions';
import { UserProfile } from '@/components/UserProfile';
import { SignInModal } from '@/components/SignInModal';
import { WelcomeHero } from '@/components/WelcomeHero';
import TopNavBar from '@/components/TopNavBar';
import BottomNavBar from '@/components/BottomNavBar';
import { getLegacyPitches, mockUser } from '@/lib/data';
import { LegacyPitch } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  // Use legacy pitches for backwards compatibility
  const legacyPitches = getLegacyPitches();
  const [currentPitch, setCurrentPitch] = useState<LegacyPitch>(legacyPitches[0]);
  const [handlers, setHandlers] = useState<{
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onShare: () => void;
  } | null>(null);

  // Show sign-in modal if user is not authenticated (after loading)
  useEffect(() => {
    if (!loading && !user) {
      setSignInModalOpen(true);
    }
  }, [user, loading]);

  // Filter user's own pitches (in production, fetch from API by user ID)
  const userPitches = legacyPitches.filter((pitch) =>
    pitch.founderName === mockUser.name // Mock: would match mockUser.id in production
  );

  const handlePitchChange = useCallback((pitch: LegacyPitch, newHandlers: typeof handlers) => {
    setCurrentPitch(pitch);
    setHandlers(newHandlers);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show welcome hero for non-authenticated users
  if (!user) {
    return (
      <>
        <WelcomeHero />
        <SignInModal
          isOpen={signInModalOpen}
          onClose={() => setSignInModalOpen(false)}
        />
      </>
    );
  }

  // Show main app for authenticated users
  return (
    <div className="flex min-h-screen bg-black">
      {/* Left Sidebar Navigation - Hidden on mobile */}
      <div className="hidden lg:block">
        <SidebarNav onPostClick={() => setRecordingStudioOpen(true)} />
      </div>

      {/* Top Navigation Bar - Mobile Only */}
      <div className="lg:hidden">
        <TopNavBar />
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="lg:hidden">
        <BottomNavBar
          onCreateClick={() => setRecordingStudioOpen(true)}
          onProfileClick={() => setProfileOpen(true)}
        />
      </div>

      {/* Profile Button - Desktop Only (Top Right) */}
      <button
        onClick={() => setProfileOpen(true)}
        className="hidden lg:block fixed top-4 right-4 z-50 w-11 h-11 rounded-full border-2 border-slate-700 hover:border-neon-cyan transition-all overflow-hidden group"
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
              pitches={legacyPitches}
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
            pitches={legacyPitches}
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
