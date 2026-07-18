'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LegacyPitch, FeedbackFormData } from '@/types';
import { VideoPlayer } from './VideoPlayer';
import { FloatingPitchInfo } from './FloatingPitchInfo';
import { FloatingReactions } from './FloatingReactions';
import { QuickFeedbackPanel } from './QuickFeedbackPanel';
import { FeedbackThreadPanel } from './FeedbackThreadPanel';

interface FullScreenVideoFeedProps {
  pitches: LegacyPitch[];
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
  onCurrentPitchChange,
  hideReactions = false,
  isGuest = false,
  onSignInClick
}: FullScreenVideoFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [feedbackListOpen, setFeedbackListOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>('toast');
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const [localPitches, setLocalPitches] = useState<LegacyPitch[]>(pitches);
  const [userReaction, setUserReaction] = useState<'roast' | 'toast' | null>(null);
  const [bookmarkState, setBookmarkState] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<{ type: ReactionBurstType; id: number } | null>(null);
  const [reactionPending, setReactionPending] = useState(false);
  const wheelLockRef = useRef(false);
  const reactionBurstTimeoutRef = useRef<number | null>(null);
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
    };
  }, []);

  // Sync local pitches when props change
  React.useEffect(() => {
    setLocalPitches(pitches);
  }, [pitches]);

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
    if (!currentPitch) return false;

    try {
      const response = await fetch(`/api/pitches/${currentPitch.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: feedback.type,
          signal: feedback.signal,
          signals: feedback.signals,
          readiness: feedback.readiness,
          scores: feedback.scores,
          notes: feedback.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to submit feedback:', error);
        return false;
      } else {
        const data = await response.json();
        const submittedFeedback = {
          id: data.feedback?.id || `${currentPitch.id}-${Date.now()}`,
          authorName: 'You',
          authorRole: 'Founder',
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
            p.id === currentPitch.id
              ? { ...p, feedback: [...(p.feedback || []), submittedFeedback] }
              : p
          )
        );
        triggerReactionBurst(feedback.type);
        // Close feedback panel after successful submission
        setFeedbackPanelOpen(false);
        return true;
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return false;
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
    setFeedbackType(type);
    setFeedbackListOpen(false);
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
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>Loading pitches...</p>
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
      {...(isFeedbackOverlayOpen ? {} : bind())}
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
            playing={true}
            onEnded={goToNext}
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
              className="absolute top-20 left-1/2 -translate-x-1/2 text-white pointer-events-none"
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
      />

      {/* Quick Feedback Panel renders after the thread panel so the first Toast/Roast tap brings it above the closing thread sheet. */}
      <QuickFeedbackPanel
        isOpen={feedbackPanelOpen}
        onClose={() => setFeedbackPanelOpen(false)}
        onSubmit={handleFeedbackSubmit}
        initialType={feedbackType}
      />

    </div>
  );
}
