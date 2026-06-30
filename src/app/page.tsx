'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
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
import { getLegacyPitches, mockUser, profileToUser, authUserToUser } from '@/lib/data';
import { LegacyPitch, User, Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ProfileSetupModal } from '@/components/ProfileSetupModal';
import { ProfileEditModal } from '@/components/ProfileEditModal';
import { GamificationStats } from '@/components/GamificationStats';

// Lazy load modal components (not needed on initial page load)
const DailyChallengeBanner = dynamic(() => import('@/components/DailyChallengeBanner').then(mod => ({ default: mod.DailyChallengeBanner })), {
  ssr: false,
});
const AchievementUnlock = dynamic(() => import('@/components/AchievementUnlock').then(mod => ({ default: mod.AchievementUnlock })), {
  ssr: false,
});

export default function Home() {
  const { user, loading } = useAuth();
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [showGuestFeedPreview, setShowGuestFeedPreview] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [showAchievementUnlock, setShowAchievementUnlock] = useState(false);
  const [achievement, setAchievement] = useState<{
    badgeIcon: string;
    badgeName: string;
    badgeDescription: string;
  } | null>(null);
  const isGuest = !user;

  // Fetch user profile from Supabase when user logs in
  useEffect(() => {
    const fetchUserProfile = async () => {
      console.log('fetchUserProfile called, user:', user);

      if (!user) {
        console.log('No user, clearing profile');
        setUserProfile(null);
        return;
      }

      // Always create a user object from auth data first
      const authBasedUser = authUserToUser(user);
      console.log('Created user from auth data:', authBasedUser);

      try {
        const supabase = createClient();
        console.log('Fetching profile for user ID:', user.id);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('Profile fetch result - data:', data, 'error:', error);

        if (!error && data) {
          console.log('Converting database profile to user format:', data);
          const dbUser = profileToUser(data);
          console.log('Converted database user:', dbUser);
          setUserProfile(dbUser);
          setFullProfile(data);
          // Profile setup is now on-demand only, triggered by user action, not automatically
        } else {
          // If profiles table fetch fails or returns nothing, use auth user data
          console.log('Profiles table fetch failed or returned no data, using auth-based user');
          setUserProfile(authBasedUser);
          // Profile setup is now on-demand only, triggered by user action, not automatically
        }
      } catch (err) {
        console.error('Error fetching user profile, falling back to auth data:', err);
        // Fall back to auth user data on any error
        setUserProfile(authBasedUser);
        // Profile setup is now on-demand only, triggered by user action, not automatically
      }
    };

    fetchUserProfile();
  }, [user]);

  // Fetch real pitches from API
  const [legacyPitches, setLegacyPitches] = useState<LegacyPitch[]>([]);
  const [pitchesLoading, setPitchesLoading] = useState(true);
  const [currentPitch, setCurrentPitch] = useState<LegacyPitch | null>(null);
  const [handlers, setHandlers] = useState<{
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onShare: () => void;
  } | null>(null);

  // Fetch pitches from API
  const fetchPitches = useCallback(async () => {
    try {
      setPitchesLoading(true);
      const response = await fetch('/api/pitches?limit=100');
      if (!response.ok) throw new Error('Failed to fetch pitches');

      const data = await response.json();

      // Convert API format to legacy format for backwards compatibility
      const converted = data.pitches.map((pitch: any) => ({
        id: pitch.id,
        userId: pitch.user_id,
        founderName: pitch.profiles?.full_name || 'Anonymous',
        founderAvatar: pitch.profiles?.avatar_url || mockUser.avatar,
        companyName: 'Company', // Will be populated in next phase
        hook: pitch.hook,
        description: pitch.description || '',
        videoUrl: pitch.video_url,
        thumbnailUrl: pitch.thumbnail_url || '',
        industry: 'SaaS', // Default, will be added in next phase
        stage: 'Seed', // Default, will be added in next phase
        views: pitch.views_count,
        interestScore: pitch.interest_score,
        roastCount: pitch.roast_count,
        toastCount: pitch.toast_count,
        createdAt: pitch.created_at,
        duration: pitch.duration,
      }));

      setLegacyPitches(converted);
      if (converted.length > 0 && !currentPitch) {
        setCurrentPitch(converted[0]);
      }
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
      // Fall back to mock data on error
      const mockPitches = getLegacyPitches();
      setLegacyPitches(mockPitches);
      if (mockPitches.length > 0 && !currentPitch) {
        setCurrentPitch(mockPitches[0]);
      }
    } finally {
      setPitchesLoading(false);
    }
  }, []);

  // Fetch pitches once the feed is visible. The marketing landing should stay lightweight.
  useEffect(() => {
    if (isGuest && !showGuestFeedPreview) {
      setPitchesLoading(false);
      return;
    }

    fetchPitches();
  }, [fetchPitches, isGuest, showGuestFeedPreview]);

  // Filter user's own pitches using the fetched profile
  // Only filter if we have a userProfile (to avoid showing mockUser's pitches)
  const userPitches = userProfile
    ? legacyPitches.filter((pitch) => pitch.founderName === userProfile.name)
    : [];

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
  if (isGuest && !showGuestFeedPreview) {
    return (
      <>
        <WelcomeHero
          onPreviewFeed={() => setShowGuestFeedPreview(true)}
        />
        <SignInModal
          isOpen={signInModalOpen}
          onClose={() => setSignInModalOpen(false)}
        />
      </>
    );
  }

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
          onClick={() => setShowGuestFeedPreview(false)}
          className="hidden lg:block fixed top-4 right-4 z-50 px-6 py-2.5 rounded-lg border border-white/15 bg-black/70 text-white font-semibold text-sm hover:border-neon-cyan hover:text-neon-cyan transition-all"
        >
          Back to waitlist
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
          {handlers && currentPitch && (
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

          {/* Gamification Stats - Desktop Only */}
          {!isGuest && (
            <div className="hidden lg:flex flex-col gap-4 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2">
              <GamificationStats onOpenChallenge={() => setShowDailyChallenge(true)} />
            </div>
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
          onPitchCreated={async (pitch) => {
            // Refresh feed after new pitch is created
            setTimeout(() => {
              fetchPitches();
            }, 1000); // Brief delay to allow database to settle
          }}
        />
      )}

      {/* User Profile Panel - Only for authenticated users */}
      {!isGuest && userProfile && (
        <UserProfile
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={userProfile}
          userPitches={userPitches}
          currentBio={fullProfile?.bio || undefined}
          currentWebsite={fullProfile?.website || undefined}
          currentTwitter={fullProfile?.twitter_handle || undefined}
          currentLinkedin={fullProfile?.linkedin_url || undefined}
          onEditProfile={() => setShowProfileEdit(true)}
        />
      )}

      {/* Profile Setup Modal - Shown after first login for email/phone users */}
      {!isGuest && user && (
        <ProfileSetupModal
          isOpen={showProfileSetup}
          user={user}
          onComplete={() => {
            // Close the modal - it won't show again this session due to ref
            setShowProfileSetup(false);

            // Refresh profile data after setup (optional - for UI updates)
            const fetchUpdatedProfile = async () => {
              const supabase = createClient();
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

              if (data) {
                setUserProfile(profileToUser(data));
                setFullProfile(data);
              }
            };
            fetchUpdatedProfile().catch((err) => {
              console.error('Error refreshing profile after setup:', err);
            });
          }}
        />
      )}

      {/* Profile Edit Modal - Shown when user clicks Edit Profile */}
      {!isGuest && user && (
        <ProfileEditModal
          isOpen={showProfileEdit}
          user={user}
          currentBio={fullProfile?.bio || undefined}
          currentWebsite={fullProfile?.website || undefined}
          currentTwitter={fullProfile?.twitter_handle || undefined}
          currentLinkedin={fullProfile?.linkedin_url || undefined}
          onComplete={() => {
            // Close the modal
            setShowProfileEdit(false);

            // Refresh profile data after edit (for UI updates)
            const fetchUpdatedProfile = async () => {
              const supabase = createClient();
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

              if (data) {
                setUserProfile(profileToUser(data));
                setFullProfile(data);
              }
            };
            fetchUpdatedProfile().catch((err) => {
              console.error('Error refreshing profile after edit:', err);
            });
          }}
        />
      )}

      {/* Daily Challenge Banner */}
      {!isGuest && (
        <DailyChallengeBanner
          isOpen={showDailyChallenge}
          onClose={() => setShowDailyChallenge(false)}
        />
      )}

      {/* Achievement Unlock Celebration */}
      {achievement && (
        <AchievementUnlock
          badgeIcon={achievement.badgeIcon}
          badgeName={achievement.badgeName}
          badgeDescription={achievement.badgeDescription}
          isOpen={showAchievementUnlock}
          onClose={() => setShowAchievementUnlock(false)}
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
