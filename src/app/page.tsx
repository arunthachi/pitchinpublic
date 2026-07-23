'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardCheck, Edit, LogOut, UserCircle } from 'lucide-react';
import { SidebarNav } from '@/components/SidebarNav';
import { FullScreenVideoFeed } from '@/components/FullScreenVideoFeed';
import { RecordingStudio } from '@/components/RecordingStudio';
import { FloatingReactions } from '@/components/FloatingReactions';
import { UserProfile } from '@/components/UserProfile';
import { SignInModal } from '@/components/SignInModal';
import { WelcomeHero } from '@/components/WelcomeHero';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import TopNavBar from '@/components/TopNavBar';
import BottomNavBar from '@/components/BottomNavBar';
import { getLegacyPitches, profileToUser, authUserToUser } from '@/lib/data';
import { LegacyPitch, User, Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { clearAuthPending, readAuthPending } from '@/lib/auth-pending';
import { ProfileSetupModal } from '@/components/ProfileSetupModal';
import { ProfileEditModal } from '@/components/ProfileEditModal';
import { DesktopHabitNudge, MobileHabitNudge } from '@/components/PitchHabitPanel';
import { getPromptForDate, type PracticePrompt } from '@/lib/practice';
import { getPitchFeedbackAskFromFields, getPitchStartupNameFromFields } from '@/lib/pitch-copy';
import { normalizeLegacyFeedback, normalizeReviewQueue } from '@/lib/review-marketplace';
import { ReviewQueuePanel } from '@/components/ReviewQueuePanel';
import type { ReviewQueueSummary } from '@/types';

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
      recentDays?: Array<{
        date: string;
        active: boolean;
        isToday: boolean;
      }>;
    };
  latestRep: any | null;
  readiness: {
    value: number | null;
    label: string;
  };
}

type ReviewerAccessPayload = {
  isReviewer?: boolean;
  hasAccess?: boolean;
  allowed?: boolean;
  active?: boolean;
  status?: string;
  access?: { active?: boolean; status?: string };
  reviewerAccess?: { active?: boolean; status?: string };
  membership?: { active?: boolean; status?: string };
  reviewer?: { active?: boolean; status?: string };
  founderAccess?: boolean;
};

const APP_MODE_KEY = 'pip.appMode';

function hasActiveReviewerAccess(payload: ReviewerAccessPayload) {
  const access = payload?.access || payload?.reviewerAccess || payload?.membership || payload?.reviewer;
  return payload?.isReviewer === true
    || payload?.hasAccess === true
    || payload?.allowed === true
    || payload?.active === true
    || payload?.status === 'active'
    || access?.active === true
    || access?.status === 'active';
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [showPitchGoal, setShowPitchGoal] = useState(false);
  const [showAchievementUnlock, setShowAchievementUnlock] = useState(false);
  const [inviteOnlyNotice, setInviteOnlyNotice] = useState(false);
  const [reviewerMode, setReviewerMode] = useState(false);
  const [reviewerAccess, setReviewerAccess] = useState(false);
  const [founderAccess, setFounderAccess] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  const [desktopFeed, setDesktopFeed] = useState<boolean | null>(null);
  const [practiceToday, setPracticeToday] = useState<PracticeToday>(() => {
    const prompt = getPromptForDate();
    return {
      prompt,
      nudge: `Today’s pitch task: make the customer obvious in sentence one. Record a 60-sec take. ${prompt.prompt}`,
      goal: null,
    progress: {
      practiceDays: 0,
      pitchReps: 0,
      currentStreak: 0,
      bestStreak: 0,
      clarityDelta: 0,
      bestTakeId: null,
      deadlineDaysLeft: null,
      recentDays: [],
    },
      latestRep: null,
      readiness: {
        value: null,
        label: 'No signal yet',
      },
    };
  });

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const updateFeedLayout = () => setDesktopFeed(query.matches);

    updateFeedLayout();
    query.addEventListener('change', updateFeedLayout);
    return () => query.removeEventListener('change', updateFeedLayout);
  }, []);
  const [achievement, setAchievement] = useState<{
    badgeIcon: string;
    badgeName: string;
    badgeDescription: string;
  } | null>(null);
  const isGuest = !user;
  const accountUser = userProfile || (user ? authUserToUser(user) : null);
  const canManageEvents = userRoles.includes('organizer') || userRoles.includes('admin');
  const showPublicSignIn = isGuest;
  const pitchMaxParam = Number(searchParams.get('pitchMax'));
  const recordingMaxDurationSeconds = Number.isFinite(pitchMaxParam) && pitchMaxParam >= 30 && pitchMaxParam <= 360 ? pitchMaxParam : 60;
  const eventContext = searchParams.get('eventSlug')
    ? {
        slug: searchParams.get('eventSlug') || '',
        name: searchParams.get('eventName') || 'Pitch event',
        deadline: searchParams.get('eventDeadline') || null,
        pitchLengthSeconds: recordingMaxDurationSeconds,
        focus: searchParams.get('eventFocus') || null,
      }
    : null;

  useEffect(() => {
    setAuthPending(readAuthPending());
  }, []);

  useEffect(() => {
    if (user) {
      clearAuthPending();
      setAuthPending(false);
      return;
    }

    if (!loading) {
      setAuthPending(readAuthPending());
    }
  }, [loading, user]);

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
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueSummary | null>(null);
  const [reviewRequest, setReviewRequest] = useState<{ publicPitchId: string; nonce: number } | null>(null);
  const [reviewSelectionError, setReviewSelectionError] = useState<string | null>(null);
  const [pitchesLoading, setPitchesLoading] = useState(true);
  const [currentPitch, setCurrentPitch] = useState<LegacyPitch | null>(null);
  const [handlers, setHandlers] = useState<{
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onOpenFeedbackList: () => void;
    onShare: () => void;
    onBookmark: (isBookmarked: boolean) => Promise<boolean>;
    userReaction: 'roast' | 'toast' | null;
    reactionPending: boolean;
  } | null>(null);

  const convertApiPitch = useCallback((pitch: any): LegacyPitch => {
    const feedback = (pitch.feedback || []).map(normalizeLegacyFeedback);

    return {
      id: pitch.id,
      publicId: pitch.public_id || null,
      userId: pitch.user_id,
      founderHandle: pitch.profiles?.public_handle || pitch.profiles?.username || null,
      founderName: pitch.profiles?.full_name || 'Anonymous',
      founderAvatar:
        pitch.profiles?.avatar_url ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          pitch.profiles?.full_name || pitch.profiles?.public_handle || pitch.profiles?.username || 'User'
        )}`,
      companyName: getPitchStartupNameFromFields(pitch, 'Startup'),
      hook: pitch.hook,
      description: pitch.description || '',
      feedbackAsk: getPitchFeedbackAskFromFields(pitch),
      videoUrl: pitch.video_url,
      thumbnailUrl: pitch.thumbnail_url || '',
      industry: 'SaaS',
      stage: 'Seed',
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
      isBestTake: reviewerMode ? false : Boolean(pitch.is_best_take),
      isOwnedByViewer: !reviewerMode && pitch.user_id === user?.id,
      feedback,
    };
  }, [reviewerMode, user?.id]);

  // Fetch pitches from API
  const fetchPitches = useCallback(async () => {
    try {
      setPitchesLoading(true);
      const params = new URLSearchParams({ limit: '20' });

      const response = await fetch(`/api/pitches?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch pitches');

      const data = await response.json();

      const visiblePitches = reviewerMode
        ? data.pitches.filter((pitch: any) => pitch.user_id !== user?.id)
        : data.pitches;
      const converted = visiblePitches.map(convertApiPitch);

      setLegacyPitches(converted);
      setCurrentPitch((current) => current ?? converted[0] ?? null);
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
      // Fall back to mock data on error
      const mockPitches = getLegacyPitches();
      setLegacyPitches(mockPitches);
      setCurrentPitch((current) => current ?? mockPitches[0] ?? null);
    } finally {
      setPitchesLoading(false);
    }
  }, [convertApiPitch, reviewerMode, user?.id]);

  const fetchReviewQueue = useCallback(async () => {
    if (!user) {
      setReviewQueue(null);
      return;
    }

    try {
      const response = await fetch(`/api/reviews/queue?limit=3&mode=${reviewerMode ? 'reviewer' : 'founder'}`, { cache: 'no-store' });
      if (!response.ok) {
        setReviewQueue(null);
        return;
      }
      const normalized = normalizeReviewQueue(await response.json());
      setReviewQueue(normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to fetch review queue:', error);
      setReviewQueue(null);
    }
  }, [reviewerMode, user]);

  const handleSelectReviewPitch = useCallback(async (publicPitchId: string) => {
    setReviewSelectionError(null);
    let selectedPitch = legacyPitches.find((pitch) => pitch.publicId === publicPitchId) || null;

    if (!selectedPitch) {
      try {
        const response = await fetch(`/api/pitches?publicId=${encodeURIComponent(publicPitchId)}&limit=1`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok || !payload.pitches?.[0]) {
          throw new Error(payload.error || 'This assigned pitch is not available.');
        }
        selectedPitch = convertApiPitch(payload.pitches[0]);
        setLegacyPitches((current) => [
          selectedPitch as LegacyPitch,
          ...current.filter((pitch) => pitch.publicId !== publicPitchId),
        ]);
      } catch (error) {
        console.error('Failed to open assigned review:', error);
        setReviewSelectionError('This review could not be opened. Refresh the queue and try again.');
        return;
      }
    }

    setReviewRequest({ publicPitchId, nonce: Date.now() });
  }, [convertApiPitch, legacyPitches]);

  const handleAssignedReviewComplete = useCallback(async () => {
    await fetchReviewQueue();
  }, [fetchReviewQueue]);

  const handleReviewNext = useCallback(() => {
    const next = reviewQueue?.items.find((item) => item.publicPitchId !== reviewRequest?.publicPitchId);
    if (!next) {
      setReviewRequest(null);
      return;
    }
    void handleSelectReviewPitch(next.publicPitchId);
  }, [handleSelectReviewPitch, reviewQueue, reviewRequest?.publicPitchId]);

  const fetchPracticeToday = useCallback(async () => {
    if (!user || !accessCheckComplete || reviewerMode) return;

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
  }, [accessCheckComplete, reviewerMode, user]);

  useEffect(() => {
    fetchPracticeToday();
  }, [fetchPracticeToday]);

  // Fetch pitches once the feed is visible. The marketing landing should stay lightweight.
  useEffect(() => {
    if (!user || !accessCheckComplete) {
      setPitchesLoading(false);
      return;
    }

    fetchPitches();
    fetchReviewQueue();
  }, [accessCheckComplete, fetchPitches, fetchReviewQueue, user]);

  // Filter user's own pitches using the fetched profile
  // Only filter after the authenticated profile is available.
  const userPitches = user
    ? legacyPitches.filter((pitch) => pitch.userId === user.id)
    : [];

  const handlePitchChange = useCallback((pitch: LegacyPitch, newHandlers: typeof handlers) => {
    setCurrentPitch(pitch);
    setHandlers(newHandlers);
  }, []);

  const promptForRestrictedAction = useCallback(() => {
    setSignInModalOpen(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    setAccountMenuOpen(false);
    setProfileOpen(false);
    await signOut();
    router.replace('/');
  }, [router, signOut]);

  useEffect(() => {
    if (loading || !accessCheckComplete || reviewerMode || searchParams.get('record') !== '1') return;

    if (user) {
      setRecordingStudioOpen(true);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('record');
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      }
      return;
    }

    setSignInModalOpen(true);
  }, [accessCheckComplete, loading, reviewerMode, searchParams, user]);

  useEffect(() => {
    if (loading || user) return;

    const next = searchParams.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      setSignInModalOpen(true);
    }
  }, [loading, searchParams, user]);

  useEffect(() => {
    if (loading || user) return;

    if (searchParams.get('auth') === 'invite_required') {
      setInviteOnlyNotice(true);
      setSignInModalOpen(true);
    }
  }, [loading, searchParams, user]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setReviewerMode(false);
      setReviewerAccess(false);
      setFounderAccess(false);
      setAccessCheckComplete(true);
      return;
    }

    let cancelled = false;

    const verifyPilotAccess = async () => {
      try {
        setAccessCheckComplete(false);
        const reviewerResponse = await fetch('/api/reviewer/access', { cache: 'no-store' });
        const reviewerPayload: ReviewerAccessPayload = await reviewerResponse.json().catch(() => ({}));
        const isReviewer = reviewerResponse.ok && hasActiveReviewerAccess(reviewerPayload);
        const canUseFounderMode = reviewerPayload.founderAccess === true;

        if (cancelled) return;
        setReviewerAccess(isReviewer);
        setFounderAccess(canUseFounderMode);
        const preferredMode = window.localStorage.getItem(APP_MODE_KEY);
        setReviewerMode(isReviewer && (!canUseFounderMode || preferredMode === 'reviewer'));
        if (isReviewer && !canUseFounderMode) return;

        const response = await fetch('/api/auth/access', { cache: 'no-store' });

        if (!cancelled && response.status === 403) {
          await signOut();
          router.replace('/?auth=invite_required');
        }
      } catch (error) {
        console.error('Pilot access check failed:', error);
      } finally {
        if (!cancelled) setAccessCheckComplete(true);
      }
    };

    verifyPilotAccess();

    return () => {
      cancelled = true;
    };
  }, [loading, router, signOut, user]);

  const switchAppMode = useCallback((mode: 'founder' | 'reviewer') => {
    if (mode === 'reviewer' && !reviewerAccess) return;
    if (mode === 'founder' && !founderAccess) return;
    window.localStorage.setItem(APP_MODE_KEY, mode);
    setReviewerMode(mode === 'reviewer');
  }, [founderAccess, reviewerAccess]);

  if ((loading && isGuest && authPending) || (!isGuest && !accessCheckComplete)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="glass-panel rounded-3xl px-6 py-5 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
          <p className="font-heading text-lg font-bold text-white">
            {loading ? 'Signing you in...' : 'Checking your access...'}
          </p>
          <p className="mt-1 text-sm text-slate-400">Opening your pitch feed.</p>
        </div>
      </div>
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

  // Guests stay on the marketing landing; signed-in users see the app shell.
  if (isGuest) {
    return (
      <>
        <WelcomeHero
          showSignIn={showPublicSignIn}
          onSignIn={() => setSignInModalOpen(true)}
        />
        {inviteOnlyNotice && (
          <div className="fixed inset-x-4 top-24 z-[90] mx-auto max-w-xl rounded-3xl border border-neon-lime/30 bg-slate-950/85 p-4 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <p className="font-heading text-lg font-black text-white">Pitch in Public is invite-only right now.</p>
            <p className="mt-1 text-sm text-slate-300">
              Use the email that received an invite, or request access for the founding cohort.
            </p>
            <button
              type="button"
              onClick={() => setInviteOnlyNotice(false)}
              className="mt-3 rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300 transition hover:border-neon-cyan hover:text-white"
            >
              Got it
            </button>
          </div>
        )}
        <PwaInstallPrompt dockToBottomNav={false} />
        <SignInModal
          isOpen={signInModalOpen}
          onClose={() => setSignInModalOpen(false)}
        />
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
          guestActionLabel="Sign in"
          onChallengeClick={() => isGuest ? promptForRestrictedAction() : setShowPitchGoal(true)}
          canManageEvents={canManageEvents}
          reviewerMode={reviewerMode}
          canSwitchMode={reviewerAccess && founderAccess}
          onModeChange={switchAppMode}
        />
      </div>

      {/* Top Navigation Bar - Mobile Only */}
      {reviewerMode ? (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/75 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <ClipboardCheck className="h-5 w-5 text-neon-cyan" />
            Review feed
          </div>
          <div className="flex items-center gap-2">
            {founderAccess ? (
              <button type="button" onClick={() => switchAppMode('founder')} className="btn-glass min-h-11 px-4 text-sm font-bold text-slate-100">
                Founder mode
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-glass flex h-11 w-11 items-center justify-center p-0 text-slate-200"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="lg:hidden">
          <TopNavBar
            onReviewerMode={reviewerAccess && founderAccess ? () => switchAppMode('reviewer') : undefined}
          />
        </div>
      )}

      {/* Bottom Navigation Bar - Mobile Only */}
      {!reviewerMode ? (
        <div className="lg:hidden">
          <BottomNavBar
            onCreateClick={() => isGuest ? promptForRestrictedAction() : setRecordingStudioOpen(true)}
            onProfileClick={() => isGuest ? promptForRestrictedAction() : router.push('/me')}
            onChallengeClick={() => isGuest ? promptForRestrictedAction() : setShowPitchGoal(true)}
            isGuest={isGuest}
          />
        </div>
      ) : null}

      {/* Top Right Button - Desktop Only */}
      {isGuest ? (
        <button
          onClick={() => {
            setSignInModalOpen(true);
          }}
          className="btn-glass fixed right-4 top-4 z-50 hidden px-6 py-2.5 text-sm font-semibold hover:border-neon-cyan hover:text-neon-cyan lg:block"
        >
          Sign in
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
              src={accountUser?.avatar || ''}
              alt={accountUser?.name || 'Account'}
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
                    {accountUser?.name || 'Account'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {accountUser?.email || user?.email || 'User account'}
                  </p>
                </div>

                <div className="py-2">
                  {!reviewerMode ? (
                    <>
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
                    </>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-300">
                      <ClipboardCheck className="h-5 w-5 text-neon-cyan" />
                      Trusted reviewer
                    </div>
                  )}
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
        {desktopFeed === true ? <div
          className="relative h-full w-full"
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
              isLoading={pitchesLoading}
              reviewRequest={reviewRequest}
              onAssignedReviewComplete={handleAssignedReviewComplete}
              onReviewNext={handleReviewNext}
              onExitReviewMode={() => setReviewRequest(null)}
              hideReactions={true}
              onCurrentPitchChange={handlePitchChange}
            />
            </div>
          </div>

          {/* Reactions - Outside video (desktop only) */}
          {handlers && currentPitch && (
            <div
              className="absolute z-[60] rounded-full"
              style={{
                left: 'calc(50% + var(--feed-w) / 2 + 0.9rem)',
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
                userReaction={handlers.userReaction}
                reactionPending={handlers.reactionPending}
              />
            </div>
          )}

          {!isGuest && !reviewerMode && (
            <div
              className="absolute top-4 hidden xl:block"
              style={{
                left: 'calc(50% + var(--feed-w) / 2 + 5.25rem)',
              }}
            >
              <DesktopHabitNudge
                prompt={practiceToday.prompt}
                progress={practiceToday.progress}
                latestRepCreatedAt={practiceToday.latestRep?.created_at}
                onRecord={() => setRecordingStudioOpen(true)}
                onOpenGoal={() => setShowPitchGoal(true)}
              />
            </div>
          )}

          {!isGuest && reviewQueue ? (
            <div
              className="absolute top-4 hidden xl:block"
              style={{ right: 'calc(50% + var(--feed-w) / 2 + 1.5rem)' }}
            >
              <ReviewQueuePanel queue={reviewQueue} onSelectPitch={handleSelectReviewPitch} />
            </div>
          ) : null}

        </div> : null}

        {/* Mobile: Full screen like TikTok */}
        {desktopFeed === false ? <div className="h-[100dvh] w-full">
          <FullScreenVideoFeed
            pitches={legacyPitches}
            isLoading={pitchesLoading}
            reviewRequest={reviewRequest}
            onAssignedReviewComplete={handleAssignedReviewComplete}
            onReviewNext={handleReviewNext}
            onExitReviewMode={() => setReviewRequest(null)}
            hideReactions={false}
            onCurrentPitchChange={handlePitchChange}
            isGuest={isGuest}
            onSignInClick={promptForRestrictedAction}
          />
          {!isGuest && !reviewerMode && (
            <MobileHabitNudge
              prompt={practiceToday.prompt}
              progress={practiceToday.progress}
              latestRepCreatedAt={practiceToday.latestRep?.created_at}
              onRecord={() => setRecordingStudioOpen(true)}
              onOpenGoal={() => setShowPitchGoal(true)}
            />
          )}
          {!isGuest ? <ReviewQueuePanel queue={reviewQueue} onSelectPitch={handleSelectReviewPitch} /> : null}
        </div> : null}
      </main>

      {reviewSelectionError ? (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+1rem)] z-[100] mx-auto max-w-md rounded-2xl border border-roast/35 bg-[#241519]/95 p-3 text-sm font-semibold text-red-100 shadow-2xl backdrop-blur-xl" role="alert">
          {reviewSelectionError}
        </div>
      ) : null}

      {/* Sign In Modal */}
      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />

      <PwaInstallPrompt dockToBottomNav={!isGuest && !reviewerMode} />

      {/* Recording Studio Modal - Only for authenticated users */}
      {!isGuest && !reviewerMode && (
        <RecordingStudio
          isOpen={recordingStudioOpen}
          onClose={() => setRecordingStudioOpen(false)}
          onPitchCreated={async (pitch) => {
            // Refresh feed after new pitch is created
            setTimeout(() => {
              fetchPitches();
              fetchPracticeToday();
              window.dispatchEvent(new Event('pip:pitch-created'));
            }, 1000); // Brief delay to allow database to settle
          }}
          practicePrompt={practiceToday.prompt}
          practiceGoalId={practiceToday.goal?.id || null}
          maxDurationSeconds={recordingMaxDurationSeconds}
          eventContext={eventContext}
        />
      )}

      {/* User Profile Panel - Only for authenticated users */}
      {!isGuest && !reviewerMode && userProfile && (
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
      {!isGuest && !reviewerMode && user && (
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
      {!isGuest && !reviewerMode && user && (
        <ProfileEditModal
          isOpen={showProfileEdit}
          user={user}
          currentFullName={fullProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || undefined}
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
      {!isGuest && !reviewerMode && (
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
      {!isGuest && !reviewerMode && (
        <DailyChallengeBanner
          isOpen={showDailyChallenge}
          onClose={() => setShowDailyChallenge(false)}
        />
      )}

      {/* Achievement Unlock Celebration */}
      {!reviewerMode && achievement && (
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
