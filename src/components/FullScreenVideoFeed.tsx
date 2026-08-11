'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { LegacyPitch, FeedbackFormData } from '@/types';
import { VideoPlayer } from './VideoPlayer';
import { FloatingPitchInfo } from './FloatingPitchInfo';
import { FloatingReactions } from './FloatingReactions';
import { QuickFeedbackPanel } from './QuickFeedbackPanel';
import { FeedbackThreadPanel } from './FeedbackThreadPanel';

/**
 * Structured feedback on a private cohort take requires a review assignment
 * (feedback trigger, 20260722223000). Exported for tests.
 */
export function canComposeFeedback(
  feedEventSlug: string | null,
  assignment: { publicPitchId?: string | null } | null,
  pitchPublicId: string | null | undefined,
  /**
   * Whether the cohort's event allows peer feedback. Undefined means "not
   * loaded yet" and is treated as allowed: the server is the authority, and
   * hiding the action on a slow response is worse than a rare failed submit.
   */
  peerFeedbackEnabled?: boolean
) {
  if (!feedEventSlug) return true;
  // An assigned review always composes, even where peer feedback is off.
  if (assignment?.publicPitchId && assignment.publicPitchId === pitchPublicId) return true;
  // Otherwise membership decides. Members can already WATCH these takes, so
  // commenting is the lesser permission; the event's own toggle is the only
  // thing that closes it.
  return peerFeedbackEnabled !== false;
}

/**
 * True when the feed's scope changed (open feed <-> a cohort feed, or between
 * two events), which must restart playback at the first item. Exported for
 * tests; identity-only array changes must NOT reset position.
 */
export function feedScopeChanged(previousScope: string, nextScope: string) {
  return previousScope !== nextScope;
}

/**
 * Feedback must carry its event scope so private-pitch feedback resolves
 * against event membership: from an assigned review (the assignment's event)
 * or from the cohort feed (the event the feed is scoped to). Exported for
 * tests.
 */
export function buildFeedbackEventScope(input: {
  assignment?: { eventSlug?: string | null; publicPitchId?: string | null } | null;
  pitchPublicId?: string | null;
  /** The event this feed is scoped to, when browsing a cohort feed. */
  feedEventSlug?: string | null;
}): { eventSlug: string } | Record<string, never> {
  // An assignment for THIS pitch wins: it names the exact event the review was
  // allocated against, which may differ from the feed the reviewer is browsing.
  if (
    input.assignment?.eventSlug &&
    input.assignment.publicPitchId === input.pitchPublicId
  ) {
    return { eventSlug: input.assignment.eventSlug };
  }
  // Otherwise a cohort feed carries its own event, so the server resolves
  // scope against membership. Without this, peer feedback would be submitted
  // unscoped and rejected as feedback on a private pitch.
  return input.feedEventSlug ? { eventSlug: input.feedEventSlug } : {};
}

interface FullScreenVideoFeedProps {
  pitches: LegacyPitch[];
  isLoading?: boolean;
  /** Set when the feed is scoped to one event — changes the empty copy. */
  eventName?: string | null;
  /** Slug of the event this feed is scoped to; travels with feedback. */
  eventSlug?: string | null;
  /** Whether this event allows peer feedback. Undefined = not loaded yet. */
  peerFeedbackEnabled?: boolean;
  selectionRequest?: { publicPitchId: string; nonce: number } | null;
  onPitchSelectionComplete?: (publicPitchId: string, nonce: number) => void;
  reviewRequest?: { assignmentId: string; publicPitchId: string; eventSlug?: string | null; nonce: number } | null;
  onAssignedReviewComplete?: (publicPitchId: string) => Promise<void> | void;
  onReviewNext?: () => void;
  onCurrentPitchChange?: (pitch: LegacyPitch, handlers: {
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onOpenFeedbackList: () => void;
    onShare: () => void;
    onBookmark: (isBookmarked: boolean) => Promise<boolean>;
    userReaction: 'roast' | 'toast' | null;
    reactionPending: boolean;
  }) => void;
  hideReactions?: boolean;
  isGuest?: boolean;
  onSignInClick?: () => void;
}

type ReactionBurstType = 'roast' | 'toast';

const toastBurstParticles = [
  { x: -92, y: -58, size: 18, delay: 0, rotate: -18, shape: 'bubble', color: 'bg-neon-cyan/70' },
  { x: -48, y: -104, size: 11, delay: 0.04, rotate: 28, shape: 'spark', color: 'bg-white' },
  { x: 24, y: -92, size: 16, delay: 0.08, rotate: -36, shape: 'bubble', color: 'bg-toast/70' },
  { x: 76, y: -42, size: 12, delay: 0.12, rotate: 54, shape: 'ribbon', color: 'bg-neon-lime/80' },
  { x: -106, y: 4, size: 10, delay: 0.1, rotate: 20, shape: 'spark', color: 'bg-neon-lime' },
  { x: -10, y: -42, size: 9, delay: 0.16, rotate: -12, shape: 'dot', color: 'bg-white/90' },
  { x: 98, y: 8, size: 8, delay: 0.18, rotate: 34, shape: 'dot', color: 'bg-neon-cyan' },
  { x: 38, y: -22, size: 14, delay: 0.2, rotate: -68, shape: 'ribbon', color: 'bg-white/80' },
];

const roastBurstParticles = [
  { x: -90, y: -54, size: 18, delay: 0, rotate: -24, shape: 'ember', color: 'bg-roast' },
  { x: -42, y: -102, size: 14, delay: 0.04, rotate: 18, shape: 'shard', color: 'bg-orange-400' },
  { x: 28, y: -86, size: 17, delay: 0.08, rotate: -12, shape: 'ember', color: 'bg-red-500' },
  { x: 82, y: -34, size: 12, delay: 0.12, rotate: 28, shape: 'ash', color: 'bg-amber-200' },
  { x: -104, y: 8, size: 12, delay: 0.1, rotate: -36, shape: 'shard', color: 'bg-roast' },
  { x: -2, y: -42, size: 10, delay: 0.16, rotate: 16, shape: 'ash', color: 'bg-orange-300' },
  { x: 104, y: 10, size: 9, delay: 0.18, rotate: -8, shape: 'ash', color: 'bg-red-300' },
  { x: 40, y: -22, size: 16, delay: 0.2, rotate: 42, shape: 'shard', color: 'bg-amber-500' },
];

function getToastParticleClass(shape: string) {
  if (shape === 'ribbon') return 'h-2.5 rounded-[3px]';
  if (shape === 'spark') return 'rounded-[2px]';
  return 'rounded-full';
}

function getRoastParticleClass(shape: string) {
  if (shape === 'shard') return 'rounded-[45%_55%_35%_65%]';
  if (shape === 'ash') return 'rounded-full';
  return 'rounded-[65%_35%_60%_40%]';
}

function FeedReactionBurst({ type }: { type: ReactionBurstType }) {
  const isToast = type === 'toast';

  return (
    <motion.div
      initial={{ scale: 0.94 }}
      animate={{ scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className="pointer-events-none absolute right-20 top-[44%] z-50 sm:right-24"
    >
      <div
        className={`relative z-20 whitespace-nowrap rounded-full border border-white/20 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white shadow-2xl backdrop-blur-xl ${
          isToast
            ? 'bg-toast/90 shadow-toast/30'
            : 'bg-roast/90 shadow-roast/30'
        }`}
      >
        {isToast ? 'Toast +1' : 'Roast +1'}
      </div>

      <div className="absolute left-1/2 top-1/2">
        {isToast
          ? toastBurstParticles.map((particle, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: particle.x,
                  y: particle.y,
                  scale: [0.4, 1, 0.72, 0.18],
                  rotate: particle.rotate,
                }}
                transition={{ duration: 1.05, times: [0, 0.16, 0.72, 1], delay: particle.delay, ease: 'easeOut' }}
                className={`absolute z-10 border border-white/70 shadow-[0_0_26px_rgba(0,230,246,0.82)] backdrop-blur-sm ${particle.color} ${getToastParticleClass(particle.shape)}`}
                style={{
                  height: particle.shape === 'ribbon' ? Math.max(6, particle.size * 0.45) : particle.size,
                  width: particle.shape === 'ribbon' ? particle.size * 1.75 : particle.size,
                }}
              />
            ))
          : roastBurstParticles.map((particle, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.35, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: particle.x,
                  y: particle.y,
                  scale: [0.35, 1.08, 0.7, 0.2],
                  rotate: particle.rotate,
                }}
                transition={{ duration: 0.86, times: [0, 0.16, 0.7, 1], delay: particle.delay, ease: 'easeOut' }}
                className={`absolute z-10 shadow-[0_0_28px_rgba(255,59,48,0.95)] ${particle.color} ${getRoastParticleClass(particle.shape)}`}
                style={{
                  height: particle.shape === 'shard' ? particle.size * 1.45 : particle.size,
                  width: particle.shape === 'shard' ? particle.size * 0.72 : particle.size,
                }}
              />
            ))}
      </div>

      <motion.div
        initial={{ y: 6, scale: 0.82 }}
        animate={{ y: -78, scale: [0.82, 1.25, 1.1, 0.9] }}
        transition={{ duration: isToast ? 1 : 0.88, ease: 'easeOut' }}
        className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 text-4xl drop-shadow-[0_0_18px_rgba(255,255,255,0.65)]"
      >
        {isToast ? '🥂' : '🔥'}
      </motion.div>
    </motion.div>
  );
}

export function FullScreenVideoFeed({
  pitches,
  isLoading = false,
  eventName = null,
  eventSlug: feedEventSlug = null,
  peerFeedbackEnabled,
  selectionRequest = null,
  onPitchSelectionComplete,
  reviewRequest = null,
  onAssignedReviewComplete,
  onReviewNext,
  onCurrentPitchChange,
  hideReactions = false,
  isGuest = false,
  onSignInClick
}: FullScreenVideoFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Render-safe mirror of reviewAssignmentRef: reading a ref during render
  // is neither safe nor reactive.
  const [assignedComposePitchId, setAssignedComposePitchId] = useState<string | null>(null);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [feedbackListOpen, setFeedbackListOpen] = useState(false);
  const [playerInteractionActive, setPlayerInteractionActive] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>('toast');
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const [localPitches, setLocalPitches] = useState<LegacyPitch[]>(pitches);
  const [userReaction, setUserReaction] = useState<'roast' | 'toast' | null>(null);
  const [bookmarkState, setBookmarkState] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<{ type: ReactionBurstType; id: number } | null>(null);
  const [reactionPending, setReactionPending] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  const wheelLockRef = useRef(false);
  const handledReviewNonceRef = useRef<number | null>(null);
  const handledSelectionNonceRef = useRef<number | null>(null);
  const feedbackSubmissionKeyRef = useRef<string | null>(null);
  const feedbackPitchRef = useRef<{ id: string; publicId?: string } | null>(null);
  // The event a composer was opened FROM. Captured at open time, exactly like
  // feedbackPitchRef: the feed can change scope while the sheet is up, and
  // reading the live slug at submit would attribute the review to whichever
  // cohort the feed happens to be showing by then.
  const feedbackEventSlugRef = useRef<string | null>(null);
  const reviewAssignmentRef = useRef<{
    assignmentId: string;
    publicPitchId: string;
    eventSlug?: string | null;
  } | null>(null);
  const reactionBurstTimeoutRef = useRef<number | null>(null);
  const reviewCompleteTimeoutRef = useRef<number | null>(null);
  const reactionPendingRef = useRef(false);

  const triggerReactionBurst = useCallback((type: ReactionBurstType) => {
    if (reactionBurstTimeoutRef.current) {
      window.clearTimeout(reactionBurstTimeoutRef.current);
    }

    setReactionBurst({ type, id: Date.now() });
    reactionBurstTimeoutRef.current = window.setTimeout(() => {
      setReactionBurst(null);
      reactionBurstTimeoutRef.current = null;
    }, 1100);
  }, []);

  useEffect(() => {
    const handleReactionBurst = (event: Event) => {
      const type = (event as CustomEvent<{ type?: ReactionBurstType }>).detail?.type;
      if (type === 'toast' || type === 'roast') {
        triggerReactionBurst(type);
      }
    };

    window.addEventListener('pip-reaction-burst', handleReactionBurst);
    return () => window.removeEventListener('pip-reaction-burst', handleReactionBurst);
  }, [triggerReactionBurst]);

  useEffect(() => {
    return () => {
      if (reactionBurstTimeoutRef.current) {
        window.clearTimeout(reactionBurstTimeoutRef.current);
      }
      if (reviewCompleteTimeoutRef.current) {
        window.clearTimeout(reviewCompleteTimeoutRef.current);
      }
    };
  }, []);

  // Sync local pitches when props change
  React.useEffect(() => {
    setLocalPitches(pitches);
  }, [pitches]);

  // Switching feed scope (open feed <-> a cohort feed) replaces the list under
  // a mounted component: restart at the top so the viewer never lands on a
  // stale index — which previously showed the empty state over a non-empty
  // feed, or silently swapped in an unrelated pitch at the same position.
  const feedScopeKey = feedEventSlug || '';
  const previousFeedScopeRef = useRef(feedScopeKey);
  React.useEffect(() => {
    if (!feedScopeChanged(previousFeedScopeRef.current, feedScopeKey)) return;
    previousFeedScopeRef.current = feedScopeKey;
    setCurrentIndex(0);
    setDirection('down');
  }, [feedScopeKey]);

  useEffect(() => {
    if (!selectionRequest) return;
    if (handledSelectionNonceRef.current === selectionRequest.nonce) return;
    const requestedIndex = localPitches.findIndex(
      (pitch) => pitch.publicId === selectionRequest.publicPitchId
    );
    if (requestedIndex < 0) return;

    handledSelectionNonceRef.current = selectionRequest.nonce;
    setCurrentIndex((previousIndex) => {
      setDirection(requestedIndex >= previousIndex ? 'down' : 'up');
      return requestedIndex;
    });
    setFeedbackListOpen(false);
    onPitchSelectionComplete?.(selectionRequest.publicPitchId, selectionRequest.nonce);
  }, [localPitches, onPitchSelectionComplete, selectionRequest]);

  useEffect(() => {
    if (!reviewRequest) return;
    if (handledReviewNonceRef.current === reviewRequest.nonce) return;
    const requestedIndex = localPitches.findIndex(
      (pitch) => pitch.publicId === reviewRequest.publicPitchId
    );
    if (requestedIndex < 0) return;

    handledReviewNonceRef.current = reviewRequest.nonce;
    setCurrentIndex((previousIndex) => {
      setDirection(requestedIndex >= previousIndex ? 'down' : 'up');
      return requestedIndex;
    });
    setFeedbackListOpen(false);
    setFeedbackType('toast');
    setReviewComplete(false);
    feedbackEventSlugRef.current = feedEventSlug;
    feedbackPitchRef.current = {
      id: localPitches[requestedIndex].id,
      publicId: localPitches[requestedIndex].publicId,
    };
    reviewAssignmentRef.current = {
      assignmentId: reviewRequest.assignmentId,
      publicPitchId: reviewRequest.publicPitchId,
      eventSlug: reviewRequest.eventSlug,
    };
    setAssignedComposePitchId(reviewRequest.publicPitchId);
    feedbackSubmissionKeyRef.current = crypto.randomUUID();
    setFeedbackPanelOpen(true);
  }, [reviewRequest, localPitches]);

  const currentPitch = localPitches[currentIndex];

  // Reset view tracking when pitch changes
  useEffect(() => {
    setHasTrackedView(false);
    setUserReaction(null);
    setBookmarkState(false);
    setBookmarkCount(0);
    setReactionPending(false);
    reactionPendingRef.current = false;
  }, [currentPitch?.id]);

  // Fetch user's reaction and increment views when pitch changes
  useEffect(() => {
    const fetchReactionAndTrackView = async () => {
      if (!currentPitch) return;

      try {
        // Fetch user's current reaction
        const reactionResponse = await fetch(
          `/api/pitches/${currentPitch.id}/user-reaction`
        );
        if (reactionResponse.ok) {
          const reactionData = await reactionResponse.json();
          setUserReaction(reactionData.reaction);
        }

        // Track view
        const viewResponse = await fetch(
          `/api/pitches/${currentPitch.id}/view`,
          {
            method: 'POST',
          }
        );
        if (viewResponse.ok) {
          const viewData = await viewResponse.json();
          // Update pitch with new views count
          setLocalPitches((prevPitches) =>
            prevPitches.map((p) =>
              p.id === currentPitch.id
                ? { ...p, views: viewData.viewsCount }
                : p
            )
          );
        }
      } catch (error) {
        console.error('Error fetching reaction or tracking view:', error);
      }
    };

    if (!hasTrackedView && currentPitch) {
      fetchReactionAndTrackView();
      setHasTrackedView(true);
    }
  }, [currentPitch?.id, hasTrackedView]);

  useEffect(() => {
    const fetchBookmarkStatus = async () => {
      if (!currentPitch) return;

      try {
        const response = await fetch(`/api/pitches/${currentPitch.id}/bookmark`);
        if (!response.ok) return;
        const data = await response.json();
        const nextBookmarkState = Boolean(data.isBookmarked);
        const nextBookmarkCount = data.bookmarkCount || 0;
        setBookmarkState(nextBookmarkState);
        setBookmarkCount(nextBookmarkCount);
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) =>
            p.id === currentPitch.id
              ? { ...p, isBookmarked: nextBookmarkState, bookmarkCount: nextBookmarkCount }
              : p
          )
        );
      } catch (error) {
        console.error('Error fetching bookmark status:', error);
      }
    };

    fetchBookmarkStatus();
  }, [currentPitch?.id]);
  const hasNext = currentIndex < localPitches.length - 1;
  const hasPrev = currentIndex > 0;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < localPitches.length - 1) {
        setDirection('down');
        return prev + 1;
      }
      return prev;
    });
  }, [localPitches.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev > 0) {
        setDirection('up');
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const isFeedbackOverlayOpen = feedbackPanelOpen || feedbackListOpen;

  const handleVideoEnded = useCallback(() => {
    if (isFeedbackOverlayOpen) return;
    goToNext();
  }, [isFeedbackOverlayOpen, goToNext]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (isFeedbackOverlayOpen) return;
    if (Math.abs(event.deltaY) < 24 || wheelLockRef.current) return;

    wheelLockRef.current = true;
    if (event.deltaY > 0) {
      goToNext();
    } else {
      goToPrev();
    }

    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 650);
  }, [isFeedbackOverlayOpen, goToNext, goToPrev]);

  // Gesture handling
  const bind = useGesture({
    onDrag: ({ movement: [, my], direction: [, dy], velocity: [, vy], cancel }) => {
      if (isFeedbackOverlayOpen) {
        cancel();
        return;
      }

      // Swipe up = next video
      if (my < -50 && vy > 0.5 && hasNext) {
        cancel();
        goToNext();
      }
      // Swipe down = previous video
      else if (my > 50 && vy > 0.5 && hasPrev) {
        cancel();
        goToPrev();
      }
    },
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFeedbackOverlayOpen) return;
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'ArrowDown') goToNext();
      if (e.key === 'ArrowUp') goToPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFeedbackOverlayOpen, goToNext, goToPrev]);

  const handleReaction = async (type: ReactionBurstType) => {
    if (!currentPitch || reactionPendingRef.current) return;

    const previousPitch = currentPitch;
    const previousReaction = userReaction;
    const oppositeType = type === 'roast' ? 'toast' : 'roast';

    reactionPendingRef.current = true;
    setReactionPending(true);

    try {
      if (previousReaction === type) {
        setUserReaction(null);
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) =>
            p.id === currentPitch.id
              ? {
                  ...p,
                  roastCount: type === 'roast' ? Math.max(0, p.roastCount - 1) : p.roastCount,
                  toastCount: type === 'toast' ? Math.max(0, p.toastCount - 1) : p.toastCount,
                }
              : p
          )
        );

        const deleteResponse = await fetch(`/api/pitches/${currentPitch.id}/reaction/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!deleteResponse.ok) {
          setLocalPitches((prevPitches) =>
            prevPitches.map((p) => (p.id === previousPitch.id ? previousPitch : p))
          );
          setUserReaction(previousReaction);
          return;
        }

        const data = await deleteResponse.json();
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) =>
            p.id === currentPitch.id
              ? {
                  ...p,
                  roastCount: data.counts.roastCount,
                  toastCount: data.counts.toastCount,
                }
              : p
          )
        );
        return;
      }

      let counts = {
        roastCount: currentPitch.roastCount,
        toastCount: currentPitch.toastCount,
      };

      if (previousReaction === oppositeType) {
        const deleteResponse = await fetch(`/api/pitches/${currentPitch.id}/reaction/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!deleteResponse.ok) {
          throw new Error('Failed to remove previous reaction');
        }

        const data = await deleteResponse.json();
        counts = data.counts;
      }

      const updatedPitch = {
        ...currentPitch,
        roastCount: type === 'roast' ? counts.roastCount + 1 : counts.roastCount,
        toastCount: type === 'toast' ? counts.toastCount + 1 : counts.toastCount,
      };

      setUserReaction(type);
      setLocalPitches((prevPitches) =>
        prevPitches.map((p) => (p.id === currentPitch.id ? updatedPitch : p))
      );
      triggerReactionBurst(type);

      const response = await fetch(`/api/pitches/${currentPitch.id}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`Failed to create ${type}. Status:`, response.status, 'Error:', error);
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) => (p.id === previousPitch.id ? previousPitch : p))
        );
        setUserReaction(previousReaction);
        return;
      }

      const data = await response.json();
      if (data.counts) {
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) =>
            p.id === currentPitch.id
              ? {
                  ...p,
                  roastCount: data.counts.roastCount,
                  toastCount: data.counts.toastCount,
                }
              : p
          )
        );
      } else {
        console.error('CRITICAL: No counts in response. Response data:', data);
        console.error('Response.ok was true but counts missing. This indicates API response format issue.');
      }
    } catch (error) {
      console.error(`Error saving ${type} reaction:`, error);
      setLocalPitches((prevPitches) =>
        prevPitches.map((p) => (p.id === previousPitch.id ? previousPitch : p))
      );
      setUserReaction(previousReaction);
    } finally {
      reactionPendingRef.current = false;
      setReactionPending(false);
    }
  };

  const handleRoast = async () => {
    await handleReaction('roast');
  };

  const handleToast = async () => {
    await handleReaction('toast');
  };

  const handleFeedbackSubmit = async (feedback: FeedbackFormData) => {
    const feedbackPitch = feedbackPitchRef.current
      ? localPitches.find((pitch) => pitch.id === feedbackPitchRef.current?.id)
      : currentPitch;
    if (!feedbackPitch) return false;

    try {
      const submissionKey = feedbackSubmissionKeyRef.current || crypto.randomUUID();
      feedbackSubmissionKeyRef.current = submissionKey;
      const pitchIdentifier = feedbackPitch.publicId || feedbackPitch.id;
      const response = await fetch(`/api/pitches/${encodeURIComponent(pitchIdentifier)}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': submissionKey,
        },
        body: JSON.stringify({
          type: feedback.type,
          signal: feedback.signal,
          signals: feedback.signals,
          readiness: feedback.readiness,
          scores: feedback.scores,
          notes: feedback.notes,
          ...buildFeedbackEventScope({
            assignment: reviewAssignmentRef.current,
            pitchPublicId: feedbackPitch.publicId,
            feedEventSlug: feedbackEventSlugRef.current,
          }),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Failed to submit feedback:', data);
        throw new Error(data.error || 'Could not save feedback. Please try again.');
      } else {
        const submittedFeedback = {
          id: data.feedback?.id || `${feedbackPitch.id}-${Date.now()}`,
          authorName: 'You',
          authorRole: data.feedback?.reviewerRoleLabel || 'Reviewer',
          reviewerRole: data.feedback?.reviewerRole || null,
          type: feedback.type,
          signal: data.feedback?.signal || feedback.signal,
          signals: data.feedback?.signals || feedback.signals,
          readiness: data.feedback?.readiness || feedback.readiness,
          scores: feedback.scores,
          notes: feedback.notes,
          createdAt: data.feedback?.createdAt || new Date().toISOString(),
        };

        setLocalPitches((prevPitches) =>
          prevPitches.map((p) =>
            p.id === feedbackPitch.id
              ? { ...p, feedback: [...(p.feedback || []), submittedFeedback] }
              : p
          )
        );
        triggerReactionBurst(feedback.type);
        // Close feedback panel after successful submission
        const completedReview = reviewAssignmentRef.current;
        feedbackSubmissionKeyRef.current = null;
        feedbackPitchRef.current = null;
        reviewAssignmentRef.current = null;
        setFeedbackPanelOpen(false);
        const completedReviewPublicId = completedReview?.publicPitchId;
        if (completedReviewPublicId && completedReviewPublicId === feedbackPitch.publicId) {
          setReviewComplete(true);
          await onAssignedReviewComplete?.(completedReviewPublicId);
          if (reviewCompleteTimeoutRef.current) {
            window.clearTimeout(reviewCompleteTimeoutRef.current);
          }
          reviewCompleteTimeoutRef.current = window.setTimeout(() => {
            setReviewComplete(false);
            onReviewNext?.();
            reviewCompleteTimeoutRef.current = null;
          }, 1400);
        }
        return true;
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error instanceof Error
        ? error
        : new Error('Could not save feedback. Please try again.');
    }
  };

  const handleBookmark = async (isBookmarked: boolean) => {
    if (!currentPitch) return false;

    const previousState = bookmarkState;
    const previousCount = bookmarkCount;
    setBookmarkState(isBookmarked);
    setBookmarkCount((count) => Math.max(0, count + (isBookmarked ? 1 : -1)));
    setLocalPitches((prevPitches) =>
      prevPitches.map((p) =>
        p.id === currentPitch.id
          ? {
              ...p,
              isBookmarked,
              bookmarkCount: Math.max(0, (p.bookmarkCount || bookmarkCount) + (isBookmarked ? 1 : -1)),
            }
          : p
      )
    );

    try {
      const response = await fetch(`/api/pitches/${currentPitch.id}/bookmark`, {
        method: isBookmarked ? 'POST' : 'DELETE',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setBookmarkState(previousState);
        setBookmarkCount(previousCount);
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) =>
            p.id === currentPitch.id
              ? { ...p, isBookmarked: previousState, bookmarkCount: previousCount }
              : p
          )
        );
        console.error('Failed to update bookmark:', data);
        return false;
      }

      const nextBookmarkState = Boolean(data.isBookmarked);
      const nextBookmarkCount = data.bookmarkCount || 0;
      setBookmarkState(nextBookmarkState);
      setBookmarkCount(nextBookmarkCount);
      setLocalPitches((prevPitches) =>
        prevPitches.map((p) =>
          p.id === currentPitch.id
            ? { ...p, isBookmarked: nextBookmarkState, bookmarkCount: nextBookmarkCount }
            : p
        )
      );
      return true;
    } catch (error) {
      setBookmarkState(previousState);
      setBookmarkCount(previousCount);
      setLocalPitches((prevPitches) =>
        prevPitches.map((p) =>
          p.id === currentPitch.id
            ? { ...p, isBookmarked: previousState, bookmarkCount: previousCount }
            : p
        )
      );
      console.error('Error updating bookmark:', error);
      return false;
    }
  };

  const handleShare = () => {
    if (!currentPitch) return;

    if (navigator.share) {
      navigator.share({
        title: currentPitch.companyName,
        text: currentPitch.hook,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const openFeedback = (type: 'roast' | 'toast') => {
    // Membership authorises feedback on a cohort take. The only closed case is
    // an organizer turning peer feedback off, where showing the thread beats a
    // form that would fail on submit.
    if (
      !canComposeFeedback(
        feedEventSlug,
        reviewAssignmentRef.current,
        currentPitch?.publicId,
        peerFeedbackEnabled
      )
    ) {
      setFeedbackPanelOpen(false);
      setFeedbackListOpen(true);
      return;
    }
    setFeedbackType(type);
    setFeedbackListOpen(false);
    feedbackPitchRef.current = currentPitch
      ? { id: currentPitch.id, publicId: currentPitch.publicId }
      : null;
    feedbackEventSlugRef.current = feedEventSlug;
    reviewAssignmentRef.current = null;
    setAssignedComposePitchId(null);
    feedbackSubmissionKeyRef.current = crypto.randomUUID();
    setFeedbackPanelOpen(true);
  };

  const openFeedbackList = () => {
    setFeedbackPanelOpen(false);
    setFeedbackListOpen(true);
  };

  const promptForFeedbackSignIn = () => {
    setFeedbackListOpen(false);
    setFeedbackPanelOpen(false);
    onSignInClick?.();
  };

  // Notify parent of current pitch changes
  useEffect(() => {
    if (currentPitch && onCurrentPitchChange) {
      onCurrentPitchChange(currentPitch, {
        onRoast: handleRoast,
        onToast: handleToast,
        onOpenFeedback: openFeedback,
        onOpenFeedbackList: openFeedbackList,
        onShare: handleShare,
        onBookmark: handleBookmark,
        userReaction,
        reactionPending,
      });
    }
  }, [currentPitch, onCurrentPitchChange, reactionPending, userReaction]);

  if (!currentPitch) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-white/60 text-center">
          {isLoading ? (
            <>
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p>Loading pitches...</p>
            </>
          ) : (
            <div className="mx-auto max-w-xs px-6">
              <p className="font-heading text-xl font-black text-white">
                {eventName ? 'No takes in this event yet' : 'No pitches yet'}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                {eventName
                  ? `Be the first to record for ${eventName} — your cohort will see it here.`
                  : 'Record the first pitch or check back when founders begin posting.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const slideVariants = {
    enter: (direction: 'up' | 'down') => ({
      y: direction === 'down' ? '100%' : '-100%',
    }),
    center: {
      y: 0,
    },
    exit: (direction: 'up' | 'down') => ({
      y: direction === 'down' ? '-100%' : '100%',
    }),
  };

  return (
    <div
      data-feed-frame="true"
      className="relative h-full w-full touch-none overflow-hidden bg-black"
      onWheel={handleWheel}
      {...(isFeedbackOverlayOpen || playerInteractionActive ? {} : bind())}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentPitch.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            y: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="absolute inset-0"
        >
          {/* Video */}
          <VideoPlayer
            url={currentPitch.videoUrl}
            playing={!isFeedbackOverlayOpen}
            onEnded={handleVideoEnded}
            onInteractionChange={setPlayerInteractionActive}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-black/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-72 bg-gradient-to-t from-black via-black/62 to-transparent" />

          {/* Floating Info */}
          <FloatingPitchInfo pitch={currentPitch} reserveActionRail={!hideReactions} />

          {/* Floating Reactions - positioned on right side like TikTok */}
          {!hideReactions && (
            <div className="absolute bottom-24 right-2 z-[60] sm:bottom-32 sm:right-3">
              <FloatingReactions
                pitch={currentPitch}
                onRoast={isGuest && onSignInClick ? onSignInClick : handleRoast}
                onToast={isGuest && onSignInClick ? onSignInClick : handleToast}
                onOpenFeedback={isGuest && onSignInClick ? () => onSignInClick() : openFeedback}
                onOpenFeedbackList={openFeedbackList}
                onShare={isGuest && onSignInClick ? onSignInClick : handleShare}
                onBookmark={handleBookmark}
                isGuest={isGuest}
                onSignInClick={onSignInClick}
                userReaction={userReaction}
                reactionPending={reactionPending}
                isBookmarked={currentPitch.isBookmarked ?? bookmarkState}
                bookmarkCount={currentPitch.bookmarkCount ?? bookmarkCount}
              />
            </div>
          )}

      <AnimatePresence>
        {reviewComplete && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[75] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-[#101820]/90 px-4 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            <span className="grid size-6 place-items-center rounded-full bg-toast text-slate-950">
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            </span>
            Useful signal sent
          </motion.div>
        )}
            {reactionBurst && (
              <FeedReactionBurst
                key={reactionBurst.id}
                type={reactionBurst.type}
              />
            )}
          </AnimatePresence>

          {/* Navigation Hints */}
          {hasPrev && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="absolute top-[calc(8rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 text-white pointer-events-none"
            >
              <ChevronUp className="w-8 h-8 animate-bounce" />
            </motion.div>
          )}
          {hasNext && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 text-white pointer-events-none"
            >
              <ChevronDown className="w-8 h-8 animate-bounce" />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <FeedbackThreadPanel
        isOpen={feedbackListOpen}
        feedback={currentPitch.feedback || []}
        onClose={() => setFeedbackListOpen(false)}
        onAddFeedback={isGuest && onSignInClick ? promptForFeedbackSignIn : openFeedback}
        canRateQuality={Boolean(currentPitch.isOwnedByViewer)}
        composeUnavailableNote={
          canComposeFeedback(
            feedEventSlug,
            assignedComposePitchId ? { publicPitchId: assignedComposePitchId } : null,
            currentPitch?.publicId,
            peerFeedbackEnabled
          )
            ? null
            : 'The organizer has turned off peer feedback for this event.'
        }
      />

      {/* Quick Feedback Panel renders after the thread panel so the first Toast/Roast tap brings it above the closing thread sheet. */}
      <QuickFeedbackPanel
        isOpen={feedbackPanelOpen}
        onClose={() => {
          feedbackSubmissionKeyRef.current = null;
          feedbackPitchRef.current = null;
          reviewAssignmentRef.current = null;
          setFeedbackPanelOpen(false);
        }}
        onSubmit={handleFeedbackSubmit}
        initialType={feedbackType}
      />

    </div>
  );
}
