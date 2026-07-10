'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit, LogOut, UserCircle } from 'lucide-react';
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
import { PracticeLoopPanel } from '@/components/PracticeLoopPanel';
import { getPromptForDate, type PracticePrompt } from '@/lib/practice';
import { getPitchFeedbackAskFromFields, getPitchStartupNameFromFields } from '@/lib/pitch-copy';

// Lazy load modal components (not needed on initial page load)
const DailyChallengeBanner = dynamic(() => import('@/components/DailyChallengeBanner').then(mod => ({ default: mod.DailyChallengeBanner })), {
  ssr: false,
});
const PitchGoalPanel = dynamic(() => import('@/components/PitchGoalPanel').then(mod => ({ default: mod.PitchGoalPanel })), {
  ssr: false,
});
const AchievementUnlock = dynamic(() => import('@/components/AchievementUnlock').then(mod => ({ default: mod.AchievementUnlock })), {
  ssr: false,
});

const PRELAUNCH_PREVIEW_VIDEO_ID = '095d0785cea145007372cff7878fb46f';

interface PracticeToday {
  prompt: PracticePrompt;
  nudge: string;
  goal: any | null;
  progress: {
    practiceDays: number;
    pitchReps: number;
    currentStreak: number;
    bestStreak: number;
    clarityDelta: number;
    bestTakeId: string | null;
    deadlineDaysLeft: number | null;
  };
  latestRep: any | null;
  readiness: {
    value: number | null;
    label: string;
  };
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [alphaAccessEnabled, setAlphaAccessEnabled] = useState(false);
  const [showGuestFeedPreview, setShowGuestFeedPreview] = useState(false);
  const [urlAccess, setUrlAccess] = useState({
    alpha: false,
    preview: false,
    checked: false,
  });
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [showPitchGoal, setShowPitchGoal] = useState(false);
  const [showAchievementUnlock, setShowAchievementUnlock] = useState(false);
  const [practiceToday, setPracticeToday] = useState<PracticeToday>(() => {
    const prompt = getPromptForDate();
    return {
      prompt,
      nudge: `Today's pitch task: ${prompt.prompt} Record a 60-second take and see if it beats your best one.`,
      goal: null,
      progress: {
        practiceDays: 0,
        pitchReps: 0,
        currentStreak: 0,
        bestStreak: 0,
        clarityDelta: 0,
        bestTakeId: null,
        deadlineDaysLeft: null,
      },
      latestRep: null,
      readiness: {
        value: null,
        label: 'No signal yet',
      },
    };
  });
  const [achievement, setAchievement] = useState<{
    badgeIcon: string;
    badgeName: string;
    badgeDescription: string;
  } | null>(null);
  const isGuest = !user;
  const canManageEvents = userRoles.includes('organizer');
  const urlPreviewAccess = urlAccess.preview || searchParams.get('preview') === '1';
  const urlAlphaAccess = urlAccess.alpha || searchParams.get('alpha') === '1';
  const isAuthHandoff = searchParams.get('auth') === '1';
  const effectiveGuestFeedPreview = showGuestFeedPreview || urlPreviewAccess;
  const showAlphaControls = alphaAccessEnabled || urlAlphaAccess || process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setUrlAccess({
      alpha: params.get('alpha') === '1',
      preview: params.get('preview') === '1',
      checked: true,
    });
  }, []);

  // Fetch user profile from Supabase when user logs in
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setUserProfile(null);
        setUserRoles([]);
        return;
      }

      // Always create a user object from auth data first
      const authBasedUser = authUserToUser(user);

      try {
        const supabase = createClient();

        const { data: roles } = await supabase
          .from('profile_roles')
          .select('role')
          .eq('user_id', user.id);

        setUserRoles((roles || []).map((item) => item.role));

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          const dbUser = profileToUser(data);
          setUserProfile(dbUser);
          setFullProfile(data);
          // Profile setup is now on-demand only, triggered by user action, not automatically
        } else {
          // If profiles table fetch fails or returns nothing, use auth user data
          setUserProfile(authBasedUser);
          // Profile setup is now on-demand only, triggered by user action, not automatically
        }
      } catch (err) {
        console.error('Error fetching user profile, falling back to auth data:', err);
        // Fall back to auth user data on any error
        setUserProfile(authBasedUser);
        setUserRoles([]);
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
    onOpenFeedbackList: () => void;
    onShare: () => void;
    onBookmark: (isBookmarked: boolean) => Promise<boolean>;
  } | null>(null);

  // Fetch pitches from API
  const fetchPitches = useCallback(async () => {
    try {
      setPitchesLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (isGuest && effectiveGuestFeedPreview) {
        params.set('videoId', PRELAUNCH_PREVIEW_VIDEO_ID);
      }

      const response = await fetch(`/api/pitches?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch pitches');

      const data = await response.json();

      // Convert API format to legacy format for backwards compatibility
      const converted = data.pitches.map((pitch: any) => {
        const feedback = (pitch.feedback || []).map((item: any) => {
          let parsedContent: any = {};
          try {
            parsedContent = item.content ? JSON.parse(item.content) : {};
          } catch {
            parsedContent = { notes: item.content || '' };
          }

          return {
            id: item.id,
            authorName: 'Builder',
            authorRole: 'Founder',
            type: item.type,
            signal: parsedContent.signal,
            signals: parsedContent.signals || (parsedContent.signal ? [parsedContent.signal] : undefined),
            readiness: parsedContent.readiness,
            scores: parsedContent.scores || {
              clarity: 5,
              solution: 5,
              market: 5,
              presentation: 5,
            },
            notes: parsedContent.notes || '',
            createdAt: item.created_at,
          };
        });

        return {
          id: pitch.id,
          userId: pitch.user_id,
          founderName: pitch.profiles?.full_name || 'Anonymous',
          founderAvatar: pitch.profiles?.avatar_url || mockUser.avatar,
          companyName: getPitchStartupNameFromFields(pitch, 'Startup'),
          hook: pitch.hook,
          description: pitch.description || '',
          feedbackAsk: getPitchFeedbackAskFromFields(pitch),
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
          versionNumber: pitch.take_version || pitch.version_number,
          practiceGoalId: pitch.practice_goal_id || null,
          promptKey: pitch.prompt_key || null,
          promptText: pitch.prompt_text || null,
          isBestTake: Boolean(pitch.is_best_take),
          feedback,
        };
      });

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
  }, [isGuest, effectiveGuestFeedPreview]);

  const fetchPracticeToday = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/practice/today');
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.prompt && data.progress) {
        setPracticeToday(data);
      }
    } catch (error) {
      console.error('Failed to fetch practice today:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchPracticeToday();
  }, [fetchPracticeToday]);

  // Fetch pitches once the feed is visible. The marketing landing should stay lightweight.
  useEffect(() => {
    if (isGuest && !effectiveGuestFeedPreview) {
      setPitchesLoading(false);
      return;
    }

    fetchPitches();
  }, [fetchPitches, isGuest, effectiveGuestFeedPreview]);

  // Filter user's own pitches using the fetched profile
  // Only filter if we have a userProfile (to avoid showing mockUser's pitches)
  const userPitches = user
    ? legacyPitches.filter((pitch) => pitch.userId === user.id)
    : [];

  const handlePitchChange = useCallback((pitch: LegacyPitch, newHandlers: typeof handlers) => {
    setCurrentPitch(pitch);
    setHandlers(newHandlers);
  }, []);

  const returnToInvitePage = useCallback(() => {
    setShowGuestFeedPreview(false);
    setSignInModalOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('preview');
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }, []);

  const promptForRestrictedAction = useCallback(() => {
    if (showAlphaControls) {
      setSignInModalOpen(true);
      return;
    }

    returnToInvitePage();
  }, [returnToInvitePage, showAlphaControls]);

  const handleSignOut = useCallback(async () => {
    setAccountMenuOpen(false);
    setProfileOpen(false);
    await signOut();
    router.replace('/');
  }, [router, signOut]);

  useEffect(() => {
    if (loading || searchParams.get('record') !== '1') return;

    if (user) {
      setRecordingStudioOpen(true);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('record');
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      }
      return;
    }

    if (showAlphaControls) {
      setSignInModalOpen(true);
    }
  }, [loading, searchParams, showAlphaControls, user]);

  // The public prelaunch landing should not wait on Supabase auth initialization.
  // Authenticated users may see the landing briefly while their session resolves,
  // which is better than blocking first paint for every anonymous visitor.
  if (!urlAccess.checked && !urlPreviewAccess && !urlAlphaAccess) {
    return (
      <WelcomeHero
        showAlphaSignIn={showAlphaControls}
        onAlphaSignIn={() => setSignInModalOpen(true)}
        onAlphaPreview={() => setShowGuestFeedPreview(true)}
      />
    );
  }

  if (loading && isGuest && isAuthHandoff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="glass-panel rounded-3xl px-6 py-5 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
          <p className="font-heading text-lg font-bold text-white">Signing you in...</p>
          <p className="mt-1 text-sm text-slate-400">Opening your pitch practice feed.</p>
        </div>
      </div>
    );
  }

  if (loading && isGuest && !effectiveGuestFeedPreview) {
    return (
      <>
        <WelcomeHero
          showAlphaSignIn={showAlphaControls}
          onAlphaSignIn={() => setSignInModalOpen(true)}
          onAlphaPreview={() => setShowGuestFeedPreview(true)}
        />
        {showAlphaControls && (
          <SignInModal
            isOpen={signInModalOpen}
            onClose={() => setSignInModalOpen(false)}
          />
        )}
      </>
    );
  }

  // Show loading state only when an authenticated session is already known.
  if (loading && !isGuest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show main app for both authenticated and non-authenticated users
  // Non-authenticated users see the feed but can't interact without signing in
  if (isGuest && !effectiveGuestFeedPreview) {
    return (
      <>
        <WelcomeHero
          showAlphaSignIn={showAlphaControls}
          onAlphaSignIn={() => setSignInModalOpen(true)}
          onAlphaPreview={() => setShowGuestFeedPreview(true)}
        />
        {showAlphaControls && (
          <SignInModal
            isOpen={signInModalOpen}
            onClose={() => setSignInModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* Left Sidebar Navigation - Hidden on mobile, shown for everyone on desktop */}
      <div className="hidden lg:block">
        <SidebarNav
          onPostClick={() => isGuest ? promptForRestrictedAction() : setRecordingStudioOpen(true)}
          isGuest={isGuest}
          onSignInClick={promptForRestrictedAction}
          guestActionLabel="Request invite"
          onChallengeClick={() => isGuest ? promptForRestrictedAction() : setShowPitchGoal(true)}
          canManageEvents={canManageEvents}
        />
      </div>

      {/* Top Navigation Bar - Mobile Only */}
      <div className="lg:hidden">
        <TopNavBar />
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="lg:hidden">
        <BottomNavBar
          onCreateClick={() => isGuest ? promptForRestrictedAction() : setRecordingStudioOpen(true)}
          onProfileClick={() => isGuest ? promptForRestrictedAction() : router.push('/me')}
          onChallengeClick={() => isGuest ? promptForRestrictedAction() : setShowPitchGoal(true)}
          isGuest={isGuest}
        />
      </div>

      {/* Top Right Button - Desktop Only */}
      {isGuest ? (
        <button
          onClick={() => setShowGuestFeedPreview(false)}
          className="btn-glass fixed right-4 top-4 z-50 hidden px-6 py-2.5 text-sm font-semibold hover:border-neon-cyan hover:text-neon-cyan lg:block"
        >
          Back to invite page
        </button>
      ) : (
        <div className="fixed right-4 top-4 z-50 hidden lg:block">
          <button
            type="button"
            onClick={() => setAccountMenuOpen((open) => !open)}
            className="glass-pill h-11 w-11 overflow-hidden rounded-full transition-all hover:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/60"
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
          >
            <img
              src={userProfile?.avatar || mockUser.avatar}
              alt={userProfile?.name || mockUser.name}
              className="h-full w-full object-cover transition-transform hover:scale-110"
            />
          </button>

          {accountMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 -z-10 cursor-default"
                aria-label="Close account menu"
                onClick={() => setAccountMenuOpen(false)}
              />
              <div className="glass-panel absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border-white/15 p-2 shadow-2xl shadow-black/50">
                <div className="border-b border-white/10 px-3 py-3">
                  <p className="truncate font-heading text-sm font-bold text-white">
                    {userProfile?.name || mockUser.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {userProfile?.email || user?.email || 'Founder account'}
                  </p>
                </div>

                <div className="py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      router.push('/me');
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
                  >
                    <UserCircle className="h-5 w-5 text-neon-cyan" />
                    View profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setShowProfileEdit(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
                  >
                    <Edit className="h-5 w-5 text-neon-lime" />
                    Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-roast transition hover:bg-roast/10 hover:text-red-300"
                  >
                    <LogOut className="h-5 w-5" />
                    Log out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Content Area - Video Feed */}
      <main className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_48%_8%,rgba(0,230,246,0.06),transparent_24rem),radial-gradient(circle_at_68%_72%,rgba(183,255,42,0.045),transparent_28rem)]">
        {/* Desktop: Centered with reactions on side */}
        <div
          className="relative hidden h-full w-full lg:block"
          style={{
            '--feed-h': 'clamp(640px, calc(100dvh - 2rem), 1080px)',
            '--feed-w': 'calc(var(--feed-h) * 9 / 16)',
          } as React.CSSProperties}
        >
          {/* Video Feed Container - TikTok-style responsive 9:16 frame, centered in the viewport. */}
          <div className="glass-shell absolute left-1/2 top-4 h-[var(--feed-h)] w-[var(--feed-w)] -translate-x-1/2 overflow-hidden rounded-[1.35rem] p-[1px]">
            <div className="h-full w-full overflow-hidden rounded-[1.28rem] bg-black">
            <FullScreenVideoFeed
              pitches={legacyPitches}
              hideReactions={true}
              onCurrentPitchChange={handlePitchChange}
            />
            </div>
          </div>

          {/* Reactions - Outside video (desktop only) */}
          {handlers && currentPitch && (
            <div
              className="glass-pill absolute rounded-full px-2.5 py-4"
              style={{
                left: 'calc(50% + var(--feed-w) / 2 + 1rem)',
                top: 'calc(1rem + (var(--feed-h) / 2))',
                transform: 'translateY(-50%)',
              }}
            >
              <FloatingReactions
                pitch={currentPitch}
                onRoast={isGuest ? promptForRestrictedAction : handlers.onRoast}
                onToast={isGuest ? promptForRestrictedAction : handlers.onToast}
                onOpenFeedback={isGuest ? promptForRestrictedAction : handlers.onOpenFeedback}
                onOpenFeedbackList={handlers.onOpenFeedbackList}
                onShare={isGuest ? promptForRestrictedAction : handlers.onShare}
                onBookmark={handlers.onBookmark}
                isGuest={isGuest}
                onSignInClick={promptForRestrictedAction}
                isBookmarked={currentPitch.isBookmarked}
                bookmarkCount={currentPitch.bookmarkCount || 0}
              />
            </div>
          )}

          {!isGuest && (
            <div
              className="absolute bottom-4 top-4 hidden items-center xl:flex"
              style={{
                left: 'calc(50% + var(--feed-w) / 2 + 7.25rem)',
              }}
            >
              <PracticeLoopPanel
                prompt={practiceToday.prompt}
                nudge={practiceToday.nudge}
                progress={practiceToday.progress}
                readinessLabel={practiceToday.readiness.label}
                goalName={practiceToday.goal?.name}
                latestRepNumber={practiceToday.latestRep?.rep_number}
                onRecord={() => setRecordingStudioOpen(true)}
                onOpenGoal={() => setShowPitchGoal(true)}
              />
            </div>
          )}

        </div>

        {/* Mobile: Full screen like TikTok */}
        <div className="h-[100dvh] w-full lg:hidden">
          <FullScreenVideoFeed
            pitches={legacyPitches}
            hideReactions={false}
            onCurrentPitchChange={handlePitchChange}
            isGuest={isGuest}
            onSignInClick={promptForRestrictedAction}
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
              fetchPracticeToday();
            }, 1000); // Brief delay to allow database to settle
          }}
          practicePrompt={practiceToday.prompt}
          practiceGoalId={practiceToday.goal?.id || null}
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
          onOpenChallenge={() => {
            setProfileOpen(false);
            setShowPitchGoal(true);
          }}
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
        <PitchGoalPanel
          isOpen={showPitchGoal}
          onClose={() => setShowPitchGoal(false)}
          onRecordPitch={() => {
            setShowPitchGoal(false);
            setRecordingStudioOpen(true);
          }}
          userPitches={userPitches}
          practiceGoal={practiceToday.goal}
          onGoalSaved={fetchPracticeToday}
        />
      )}

      {/* Daily Challenge Banner - retained for backend challenge responses. */}
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
        <div className="glass-pill rounded-full px-4 py-2">
          <p className="text-xs text-white font-body">
            Swipe up/down or use arrow keys
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}
