'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Flame,
  Globe,
  Loader2,
  Lock,
  Sparkles,
  Target,
  User,
} from 'lucide-react';
import { getLegacyPitchById } from '@/lib/data';
import { FeedbackModal } from '@/components/FeedbackModal';
import { PivotHistory } from '@/components/PivotHistory';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeedbackFormData, LegacyPitch } from '@/types';
import { isPublicPitchId, isUuidLike } from '@/lib/public-routes';
import { getPitchFeedbackAskFromFields, getPitchStartupNameFromFields } from '@/lib/pitch-copy';
import { feedbackReviewerDisplay, normalizeLegacyFeedback } from '@/lib/review-marketplace';
import { FeedbackQualityControls } from '@/components/FeedbackQualityControls';
import { useAuth } from '@/contexts/AuthContext';
import { ActionPageNav } from '@/components/ActionPageNav';
import AppTabBar from '@/components/AppTabBar';
import { destination, eventDashboardDestination } from '@/lib/app-navigation';
import { VideoPlayer } from '@/components/VideoPlayer';

function readinessLabel(value?: number) {
  if (!value) return 'Getting there';
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

function readinessFromScores(scores: FeedbackFormData['scores']) {
  const average = (scores.clarity + scores.solution + scores.market + scores.presentation) / 4;
  return Math.max(1, Math.min(4, Math.round(average / 2.5)));
}

function parseFeedback(rawFeedback: any[] | undefined) {
  return (rawFeedback || []).map(normalizeLegacyFeedback);
}

function convertApiPitchToLegacy(pitch: any, viewerId?: string): LegacyPitch {
  const profile = pitch.profiles || {};
  return {
    id: pitch.id,
    publicId: pitch.public_id || null,
    userId: pitch.user_id,
    founderHandle: profile.public_handle || profile.username || null,
    founderName: profile.full_name || 'Founder',
    founderAvatar: profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP',
    companyName: getPitchStartupNameFromFields(pitch, 'Practice pitch'),
    hook: pitch.hook,
    description: pitch.description || getPitchFeedbackAskFromFields(pitch),
    feedbackAsk: getPitchFeedbackAskFromFields(pitch),
    videoUrl: pitch.video_url,
    thumbnailUrl: pitch.thumbnail_url || '',
    industry: 'SaaS',
    stage: 'Pre-Seed',
    views: pitch.views_count || 0,
    interestScore: pitch.interest_score || 0,
    roastCount: pitch.roast_count || 0,
    toastCount: pitch.toast_count || 0,
    createdAt: pitch.created_at,
    duration: pitch.duration || undefined,
    versionNumber: pitch.take_version || pitch.version_number,
    practiceGoalId: pitch.practice_goal_id || null,
    promptKey: pitch.prompt_key || null,
    promptText: pitch.prompt_text || null,
    isBestTake: Boolean(pitch.is_best_take),
    isOwnedByViewer: Boolean(viewerId && pitch.user_id === viewerId),
    visibility: pitch.visibility || 'public',
    eventId: pitch.event_id || null,
    eventSlug: (Array.isArray(pitch.pitch_events) ? pitch.pitch_events[0]?.slug : pitch.pitch_events?.slug) || null,
    feedback: parseFeedback(pitch.feedback),
  };
}

function PitchDetailContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pitchId = params.id as string;
  const mockPitch = getLegacyPitchById(pitchId);
  const [remotePitch, setRemotePitch] = useState<LegacyPitch | null>(null);
  const [loadingPitch, setLoadingPitch] = useState(!mockPitch);
  const pitch = mockPitch || remotePitch;
  const [localFeedback, setLocalFeedback] = useState(mockPitch?.feedback || []);
  const feedbackSubmissionKeyRef = React.useRef<string | null>(null);
  const feedbackHandoffHandledRef = React.useRef(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackEligibility, setFeedbackEligibility] = useState<'idle' | 'loading' | 'eligible' | 'ineligible'>('idle');
  const [feedbackEligibilityError, setFeedbackEligibilityError] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [pitchBoundGuidelineVersionId, setPitchBoundGuidelineVersionId] = useState<string | null>(null);
  const [eventRubric, setEventRubric] = useState<Array<{ id: string; label: string; description?: string | null }>>([]);
  const eventSlugValue = searchParams.get('event');
  const eventSlug = eventSlugValue && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventSlugValue)
    ? eventSlugValue
    : null;
  const wantsEventFeedback = searchParams.get('feedback') === '1' && Boolean(eventSlug);
  const dashboardHref = eventSlug
    ? `/events/${encodeURIComponent(eventSlug)}/dashboard?tab=submissions&filter=needs-feedback#dashboard-panel-submissions`
    : null;

  const removeFeedbackOpenParam = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('feedback');
    const query = next.toString();
    router.replace(query ? `/pitch/${encodeURIComponent(pitchId)}?${query}` : `/pitch/${encodeURIComponent(pitchId)}`, { scroll: false });
  }, [pitchId, router, searchParams]);

  useEffect(() => {
    if (!eventSlug || !user) {
      setEventRubric([]);
      return;
    }
    let cancelled = false;
    const versionId = pitchBoundGuidelineVersionId;
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    fetch(`/api/events/${encodeURIComponent(eventSlug)}/guidelines${query}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const current = data.published || data.guideline || (Array.isArray(data.guidelines) ? data.guidelines[0] : null);
        const criteria = Array.isArray(current?.criteria) ? current.criteria : [];
        setEventRubric(criteria.map((item: any) => ({ id: item.key, label: item.label, description: item.guidance || null })));
      })
      .catch(() => !cancelled && setEventRubric([]));
    return () => { cancelled = true; };
  }, [eventSlug, pitchBoundGuidelineVersionId, user]);

  useEffect(() => {
    if (mockPitch) return;

    const loadPitch = async () => {
      try {
        setLoadingPitch(true);
        if (!isUuidLike(pitchId) && !isPublicPitchId(pitchId)) return;
        const queryKey = isUuidLike(pitchId) ? 'pitchId' : 'publicId';
        const response = await fetch(`/api/pitches?${queryKey}=${encodeURIComponent(pitchId)}&limit=1`);
        if (!response.ok) return;
        const data = await response.json();
        const apiPitch = data.pitches?.[0];
        if (!apiPitch) return;
        if (isUuidLike(pitchId) && apiPitch.public_id) {
          router.replace(`/pitch/${encodeURIComponent(apiPitch.public_id)}`);
          return;
        }
        const converted = convertApiPitchToLegacy(apiPitch, user?.id);
        setPitchBoundGuidelineVersionId(apiPitch.event_guideline_version_id || null);
        setRemotePitch(converted);
        setLocalFeedback(converted.feedback || []);
      } finally {
        setLoadingPitch(false);
      }
    };

    loadPitch();
  }, [mockPitch, pitchId, router, user?.id]);

  useEffect(() => {
    if (!searchParams.has('feedback') || feedbackHandoffHandledRef.current) return;
    if (searchParams.get('feedback') !== '1' || !eventSlug) {
      feedbackHandoffHandledRef.current = true;
      setFeedbackEligibility('ineligible');
      setFeedbackEligibilityError('This feedback link is not valid.');
      return;
    }
    if (authLoading || loadingPitch || !pitch) return;
    if (!user) {
      feedbackHandoffHandledRef.current = true;
      setFeedbackEligibility('ineligible');
      setFeedbackEligibilityError('Sign in with an active event-team account to give feedback.');
      return;
    }
    if (pitch.isOwnedByViewer) {
      feedbackHandoffHandledRef.current = true;
      setFeedbackEligibility('ineligible');
      setFeedbackEligibilityError('You cannot leave feedback on your own pitch.');
      return;
    }

    let cancelled = false;
    setFeedbackEligibility('loading');
    setFeedbackEligibilityError('');
    void fetch(`/api/events/${encodeURIComponent(eventSlug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Event access could not be verified.');
        const exactSubmission = (payload.submissions || []).some((submission: any) =>
          submission.pitch?.public_id === pitch.publicId || submission.pitch_id === pitch.id
        );
        if (!payload.isTeamMember || !exactSubmission) {
          throw new Error('This pitch is not available for feedback from this event workspace.');
        }
        if (cancelled) return;
        feedbackHandoffHandledRef.current = true;
        setFeedbackEligibility('eligible');
        setFeedbackOpen(true);
      })
      .catch((error) => {
        if (cancelled) return;
        feedbackHandoffHandledRef.current = true;
        setFeedbackEligibility('ineligible');
        setFeedbackEligibilityError(error instanceof Error ? error.message : 'Feedback access could not be verified.');
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, eventSlug, loadingPitch, pitch, searchParams, user]);

  if (loadingPitch) {
    return (
      <div className="min-h-dvh bg-black">
        <ActionPageNav links={[destination('feed')]} ariaLabel="Pitch navigation" />
        <AppTabBar />
        <div className="flex min-h-[calc(100dvh-68px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!pitch) {
    return (
      <div className="min-h-dvh">
        <ActionPageNav links={[destination('feed')]} ariaLabel="Pitch navigation" />
        {user ? <AppTabBar /> : null}
        <div className="flex min-h-[calc(100dvh-68px)] items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-heading font-bold text-slate-100 mb-2">
            Pitch Not Found
          </h1>
          <p className="text-slate-400 mb-4 font-body">
            The pitch you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button onClick={() => router.push('/')}>Back to feed</Button>
        </div>
      </div>
    );
  }

  const handleFeedbackSubmit = async (feedbackData: FeedbackFormData) => {
    const submissionKey = feedbackSubmissionKeyRef.current || crypto.randomUUID();
    feedbackSubmissionKeyRef.current = submissionKey;
    const response = await fetch(`/api/pitches/${encodeURIComponent(pitch.publicId || pitch.id)}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': submissionKey,
      },
      // Prefer the URL's event handoff, but fall back to the pitch's own
      // event so feedback on a private event pitch scopes correctly no matter
      // which link the reviewer arrived through.
      body: JSON.stringify({
        ...feedbackData,
        ...((eventSlug || pitch.eventSlug) ? { eventSlug: eventSlug || pitch.eventSlug } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.feedback) {
      throw new Error(payload.error || 'Feedback could not be saved. Please try again.');
    }
    const savedFeedback = normalizeLegacyFeedback({
      ...payload.feedback,
      authorName: 'You',
      authorRole: payload.feedback.reviewerRoleLabel || 'Reviewer',
    });
    feedbackSubmissionKeyRef.current = null;
    setLocalFeedback((current) => [...current, savedFeedback]);
    setFeedbackSaved(true);
  };

  const handleStructuredFeedbackSubmit = async (guidance: { criterionId: string; sentiment: 'strength' | 'improvement'; observation: string; nextStep: string }) => {
    const criterion = eventRubric.find((item) => item.id === guidance.criterionId);
    await handleFeedbackSubmit({
      type: guidance.sentiment === 'strength' ? 'toast' : 'roast',
      signal: criterion?.label || 'Pitch guidance',
      signals: [criterion?.label || 'Pitch guidance'],
      readiness: guidance.sentiment === 'strength' ? 3 : 2,
      notes: `${guidance.observation}\n\nTry this next: ${guidance.nextStep}`,
      scores: { clarity: 5, solution: 5, market: 5, presentation: 5 },
      structured: {
        criterionKey: guidance.criterionId,
        sentiment: guidance.sentiment,
        observation: guidance.observation,
        nextStep: guidance.nextStep,
      },
    } as FeedbackFormData & { structured: unknown });
  };

  return (
    <div className={`min-h-dvh ${user ? 'pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-12' : 'pb-12'}`}>
      {user ? <AppTabBar /> : null}
      <ActionPageNav
        links={dashboardHref
          ? [eventDashboardDestination(eventSlug as string), destination('feed')]
          : [destination('feed')]}
        account={user ? {
          email: user.email,
          profileHref: '/me',
          onSignOut: async () => {
            await signOut();
            router.replace('/');
          },
        } : undefined}
        ariaLabel="Pitch navigation"
      />

      <div className="container mx-auto px-4 py-8">
        {/* Desktop: Split Layout, Mobile: Stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN: Video & Pitch Info */}
          <div className="space-y-6">
            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mx-auto aspect-[9/16] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black"
            >
              {pitch.videoUrl ? (
                <VideoPlayer url={pitch.videoUrl} playing />
              ) : (
                <img
                  src={pitch.thumbnailUrl}
                  alt={pitch.companyName}
                  className="h-full w-full object-cover"
                />
              )}

            </motion.div>

            {/* Pitch Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-heading font-bold text-slate-100 mb-2">
                      {pitch.companyName}
                    </h1>
                    <p className="text-lg text-slate-300 font-medium mb-4 leading-relaxed">
                      {pitch.hook}
                    </p>
                  </div>
                </div>

                {pitch.isOwnedByViewer ? (
                  <PitchVisibilityControl
                    pitch={pitch}
                    onChanged={(visibility) =>
                      setRemotePitch((current) => (current ? { ...current, visibility } : current))
                    }
                  />
                ) : null}

                <div className="border-t border-slate-800 pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={pitch.founderAvatar}
                      alt={pitch.founderName}
                      className="w-12 h-12 rounded-full border-2 border-slate-700"
                    />
                    <div>
                      <p className="font-heading font-bold text-slate-100">
                        {pitch.founderName}
                      </p>
                      <p className="text-sm text-slate-400 font-body">Founder</p>
                    </div>
                  </div>

                  <p className="text-slate-300 font-body leading-relaxed">
                    {pitch.description}
                  </p>
                </div>
              </Card>
            </motion.div>

            {/* Pivot History - Desktop: Show here, Mobile: Show after feedback */}
            {pitch.versions && pitch.versions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="hidden lg:block"
              >
                <Card className="p-6">
                  <PivotHistory versions={pitch.versions} />
                </Card>
              </motion.div>
            )}
          </div>

          {/* RIGHT COLUMN: Feedback */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="sticky top-24"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-heading font-bold text-slate-100">
                  {eventRubric.length ? 'Review focus' : 'Feedback'}
                </h2>
                {!pitch.isOwnedByViewer && feedbackEligibility !== 'ineligible' ? (
                  <FeedbackModal
                    pitchId={pitch.id}
                    onSubmit={handleFeedbackSubmit}
                    open={feedbackOpen}
                    onOpenChange={(open) => {
                      setFeedbackOpen(open);
                      if (open) {
                        setFeedbackSaved(false);
                        return;
                      }
                      if (searchParams.get('feedback') === '1') removeFeedbackOpenParam();
                    }}
                    triggerLabel={eventSlug ? 'Give feedback' : 'Leave feedback'}
                    rubric={eventRubric}
                    onStructuredSubmit={eventRubric.length ? handleStructuredFeedbackSubmit : undefined}
                  />
                ) : null}
              </div>

              {feedbackEligibility === 'loading' ? (
                <p className="mb-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 px-4 py-3 text-sm font-semibold text-slate-200" role="status">
                  Checking event feedback access...
                </p>
              ) : null}

              {feedbackEligibility === 'ineligible' ? (
                <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100" role="alert">
                  <p className="font-semibold">{feedbackEligibilityError}</p>
                  {dashboardHref ? <Link href={dashboardHref} className="mt-3 inline-flex min-h-11 items-center font-bold underline">Back to event dashboard</Link> : null}
                </div>
              ) : null}

              {feedbackSaved ? (
                <div className="mb-4 rounded-2xl border border-neon-lime/25 bg-neon-lime/10 px-4 py-3 text-sm text-slate-100" role="status">
                  <p className="font-bold">Feedback saved.</p>
                  {dashboardHref ? <Link href={dashboardHref} className="mt-3 inline-flex min-h-11 items-center font-bold text-neon-lime underline">Back to event dashboard</Link> : null}
                </div>
              ) : dashboardHref && feedbackEligibility !== 'ineligible' ? (
                <Link href={dashboardHref} className="mb-4 inline-flex min-h-11 items-center text-sm font-bold text-neon-cyan underline">
                  Back to event dashboard
                </Link>
              ) : null}

              {/* Feedback List */}
              <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                {localFeedback.length === 0 ? (
                  <Card className="p-6 text-center">
                    <h3 className="font-heading font-bold text-lg text-slate-100">No feedback yet</h3>
                    <p className="mt-2 text-slate-400 font-body">Give the founder one clear signal they can use in the next take.</p>
                  </Card>
                ) : (
                  localFeedback.map((feedback) => {
                    const isRoast = feedback.type === 'roast';
                    const readiness = feedback.readiness || readinessFromScores(feedback.scores);
                    const reviewer = feedbackReviewerDisplay(feedback);

                    return (
                      <motion.div
                        key={feedback.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Card
                          className={`p-4 border-2 ${
                            isRoast
                              ? 'border-roast/30 bg-roast/5'
                              : 'border-toast/30 bg-toast/5'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                <User className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-heading font-bold text-slate-100">
                                  {reviewer.name}
                                </p>
                                <span className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                                  {reviewer.role}
                                </span>
                                {reviewer.expertise.length ? (
                                  <p className="mt-1 max-w-[14rem] truncate text-[10px] text-slate-500">
                                    {reviewer.expertise.slice(0, 2).join(' · ')}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                                  isRoast
                                    ? 'bg-roast/20 text-roast'
                                    : 'bg-toast/20 text-toast'
                                }`}
                              >
                                {isRoast ? (
                                  <Flame className="w-4 h-4" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                <span className="text-xs font-heading font-bold">
                                  {isRoast ? 'ROAST' : 'TOAST'}
                                </span>
                              </div>
                              <div
                                className={`text-lg font-heading font-bold ${
                                  isRoast ? 'text-roast' : 'text-toast'
                                }`}
                              >
                                {readiness}/4
                              </div>
                            </div>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-200">
                              <Target className="h-3.5 w-3.5 text-neon-cyan" />
                              {(feedback.signals?.length ? feedback.signals.join(' + ') : feedback.signal) || (isRoast ? 'Sharpen the ask' : 'Clear signal')}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                              {readinessLabel(readiness)}
                            </span>
                          </div>

                          <p className="text-slate-300 font-body leading-relaxed mb-3">
                            {feedback.notes || 'No extra note added.'}
                          </p>

                          <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-slate-800">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`h-2 rounded-full ${
                                  step <= readiness
                                    ? isRoast
                                      ? 'bg-roast'
                                      : 'bg-toast'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                          {pitch.userId === user?.id && feedback.canRateQuality && feedback.qualityAction ? (
                            <FeedbackQualityControls action={feedback.qualityAction} initialRating={feedback.qualityRating} />
                          ) : null}
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Pivot History - Mobile: Show at bottom */}
        {pitch.versions && pitch.versions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:hidden mt-8"
          >
            <Card className="p-6">
              <PivotHistory versions={pitch.versions} />
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/**
 * Owner-only visibility switch: event recordings start private to their
 * event, and this is the founder's explicit control for sharing a take to
 * the public feed (or pulling it back).
 */
function PitchVisibilityControl({
  pitch,
  onChanged,
}: {
  pitch: LegacyPitch;
  onChanged: (visibility: 'public' | 'private') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPublic = (pitch.visibility || 'public') === 'public';

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const next = isPublic ? 'private' : 'public';
    try {
      const response = await fetch(`/api/pitches/${encodeURIComponent(pitch.id)}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not update visibility.');
      onChanged(data.pitch.visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update visibility.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {isPublic ? <Globe className="h-4 w-4 shrink-0 text-neon-cyan" /> : <Lock className="h-4 w-4 shrink-0 text-neon-cyan" />}
        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-200">
          {isPublic
            ? 'Public — visible in the feed'
            : pitch.eventId
              ? 'Private to your event'
              : 'Private — only you can see it'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-xs font-bold text-slate-300 transition hover:border-neon-cyan/45 hover:text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isPublic ? 'Make private' : 'Share to public feed'}
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs font-semibold text-roast">{error}</p> : null}
    </div>
  );
}

export default function PitchDetailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-black text-white">Loading pitch...</div>}>
      <PitchDetailContent />
    </Suspense>
  );
}
