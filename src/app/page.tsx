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
import { getLegacyPitches, mockUser, profileToUser } from '@/lib/data';
import { LegacyPitch, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

export default function Home() {
  const { user, loading } = useAuth();
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);

  // Fetch user profile from Supabase when user logs in
  useEffect(() => {
    const fetchUserProfile = async () => {
      console.log('fetchUserProfile called, user:', user);

      if (!user) {
        console.log('No user, clearing profile');
        setUserProfile(null);
        return;
      }

      try {
        const supabase = createClient();
        console.log('Fetching profile for user ID:', user.id);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('Profile fetch result - data:', data, 'error:', error);

        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }

        if (data) {
          console.log('Converting profile to user format:', data);
          const convertedUser = profileToUser(data);
          console.log('Converted user:', convertedUser);
          setUserProfile(convertedUser);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Use legacy pitches for backwards compatibility
  const legacyPitches = getLegacyPitches();
  const [currentPitch, setCurrentPitch] = useState<LegacyPitch>(legacyPitches[0]);
  const [handlers, setHandlers] = useState<{
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onShare: () => void;
  } | null>(null);

  // Filter user's own pitches using the fetched profile
  const currentUserName = userProfile?.name || mockUser.name;
  const userPitches = legacyPitches.filter((pitch) =>
    pitch.founderName === currentUserName
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

  // Show main app for both authenticated and non-authenticated users
  // Non-authenticated users see the feed but can't interact without signing in
  const isGuest = !user;

  return (
    <div className="flex min-h-screen bg-black">
      {/* Left Sidebar Navigation - Hidden on mobile, shown for everyone on desktop */}
      <div className="hidden lg:block">
        <SidebarNav
          onPostClick={() => isGuest ? setSignInModalOpen(true) : setRecordingStudioOpen(true)}
          isGuest={isGuest}
          onSignInClick={() => setSignInModalOpen(true)}
        />
      </div>

      {/* Top Navigation Bar - Mobile Only */}
      <div className="lg:hidden">
        <TopNavBar />
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="lg:hidden">
        <BottomNavBar
          onCreateClick={() => isGuest ? setSignInModalOpen(true) : setRecordingStudioOpen(true)}
          onProfileClick={() => isGuest ? setSignInModalOpen(true) : setProfileOpen(true)}
          isGuest={isGuest}
        />
      </div>

      {/* Top Right Button - Desktop Only */}
      {isGuest ? (
        <button
          onClick={() => setSignInModalOpen(true)}
          className="hidden lg:block fixed top-4 right-4 z-50 px-6 py-2.5 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-semibold text-sm hover:shadow-lg hover:shadow-neon-cyan/50 transition-all"
        >
          Log in
        </button>
      ) : (
        <button
          onClick={() => setProfileOpen(true)}
          className="hidden lg:block fixed top-4 right-4 z-50 w-11 h-11 rounded-full border-2 border-slate-700 hover:border-neon-cyan transition-all overflow-hidden group"
        >
          <img
            src={userProfile?.avatar || mockUser.avatar}
            alt={userProfile?.name || mockUser.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
        </button>
      )}

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
              onRoast={isGuest ? () => setSignInModalOpen(true) : handlers.onRoast}
              onToast={isGuest ? () => setSignInModalOpen(true) : handlers.onToast}
              onOpenFeedback={isGuest ? () => setSignInModalOpen(true) : handlers.onOpenFeedback}
              onShare={isGuest ? () => setSignInModalOpen(true) : handlers.onShare}
              isGuest={isGuest}
              onSignInClick={() => setSignInModalOpen(true)}
            />
          )}
        </div>

        {/* Mobile: Full screen like TikTok */}
        <div className="lg:hidden w-full h-screen">
          <FullScreenVideoFeed
            pitches={legacyPitches}
            hideReactions={false}
            onCurrentPitchChange={handlePitchChange}
            isGuest={isGuest}
            onSignInClick={() => setSignInModalOpen(true)}
          />
        </div>
      </main>

      {/* Sign In Modal */}
      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />

      {/* Recording Studio Modal - Only for authenticated users */}
      {!isGuest && (
        <RecordingStudio
          isOpen={recordingStudioOpen}
          onClose={() => setRecordingStudioOpen(false)}
        />
      )}

      {/* User Profile Panel - Only for authenticated users */}
      {!isGuest && (
        <UserProfile
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={userProfile || mockUser}
          userPitches={userPitches}
        />
      )}

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
