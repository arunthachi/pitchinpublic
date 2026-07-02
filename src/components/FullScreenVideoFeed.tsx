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

interface FullScreenVideoFeedProps {
  pitches: LegacyPitch[];
  onCurrentPitchChange?: (pitch: LegacyPitch, handlers: {
    onRoast: () => void;
    onToast: () => void;
    onOpenFeedback: (type: 'roast' | 'toast') => void;
    onShare: () => void;
  }) => void;
  hideReactions?: boolean;
  isGuest?: boolean;
  onSignInClick?: () => void;
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
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>('toast');
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const [localPitches, setLocalPitches] = useState<LegacyPitch[]>(pitches);
  const [userReaction, setUserReaction] = useState<'roast' | 'toast' | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const wheelLockRef = useRef(false);

  // Sync local pitches when props change
  React.useEffect(() => {
    setLocalPitches(pitches);
  }, [pitches]);

  const currentPitch = localPitches[currentIndex];

  // Reset view tracking when pitch changes
  useEffect(() => {
    setHasTrackedView(false);
    setUserReaction(null);
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

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
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
  }, [goToNext, goToPrev]);

  // Gesture handling
  const bind = useGesture({
    onDrag: ({ movement: [, my], direction: [, dy], velocity: [, vy], cancel }) => {
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
      if (e.key === 'ArrowDown') goToNext();
      if (e.key === 'ArrowUp') goToPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev]);

  const handleRoast = async () => {
    if (!currentPitch) return;

    try {
      // If user already roasted, toggle off (delete)
      if (userReaction === 'roast') {
        const deleteResponse = await fetch(
          `/api/pitches/${currentPitch.id}/reaction/delete`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (deleteResponse.ok) {
          const data = await deleteResponse.json();
          const finalPitch = {
            ...currentPitch,
            roastCount: data.counts.roastCount,
            toastCount: data.counts.toastCount,
          };
          setLocalPitches((prevPitches) =>
            prevPitches.map((p) => (p.id === currentPitch.id ? finalPitch : p))
          );
          setUserReaction(null);
        }
        return;
      }

      // If user has toast, delete it first before adding roast
      let counts = { roastCount: currentPitch.roastCount, toastCount: currentPitch.toastCount };

      if (userReaction === 'toast') {
        const deleteResponse = await fetch(
          `/api/pitches/${currentPitch.id}/reaction/delete`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (deleteResponse.ok) {
          const data = await deleteResponse.json();
          counts = data.counts;
        } else {
          throw new Error('Failed to remove previous reaction');
        }
      }

      // Optimistic update - update UI immediately
      const updatedPitch = {
        ...currentPitch,
        roastCount: counts.roastCount + 1,
        toastCount: counts.toastCount,
      };

      // Update local state
      setLocalPitches((prevPitches) =>
        prevPitches.map((p) => (p.id === currentPitch.id ? updatedPitch : p))
      );

      // API call in background
      const response = await fetch(`/api/pitches/${currentPitch.id}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'roast' }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to create roast. Status:', response.status, 'Error:', error);
        // Revert optimistic update on error
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) => (p.id === currentPitch.id ? currentPitch : p))
        );
      } else {
        const data = await response.json();
        // Update with actual counts from server
        if (data.counts) {
          const finalPitch = {
            ...updatedPitch,
            roastCount: data.counts.roastCount,
            toastCount: data.counts.toastCount,
          };
          setLocalPitches((prevPitches) =>
            prevPitches.map((p) => (p.id === currentPitch.id ? finalPitch : p))
          );
          setUserReaction('roast');
        } else {
          console.error('CRITICAL: No counts in response. Response data:', data);
          console.error('Response.ok was true but counts missing. This indicates API response format issue.');
        }
      }
    } catch (error) {
      console.error('Error roasting pitch:', error);
    }
  };

  const handleToast = async () => {
    if (!currentPitch) return;

    try {
      // If user already toasted, toggle off (delete)
      if (userReaction === 'toast') {
        const deleteResponse = await fetch(
          `/api/pitches/${currentPitch.id}/reaction/delete`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (deleteResponse.ok) {
          const data = await deleteResponse.json();
          const finalPitch = {
            ...currentPitch,
            roastCount: data.counts.roastCount,
            toastCount: data.counts.toastCount,
          };
          setLocalPitches((prevPitches) =>
            prevPitches.map((p) => (p.id === currentPitch.id ? finalPitch : p))
          );
          setUserReaction(null);
        }
        return;
      }

      // If user has roast, delete it first before adding toast
      let counts = { roastCount: currentPitch.roastCount, toastCount: currentPitch.toastCount };

      if (userReaction === 'roast') {
        const deleteResponse = await fetch(
          `/api/pitches/${currentPitch.id}/reaction/delete`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (deleteResponse.ok) {
          const data = await deleteResponse.json();
          counts = data.counts;
        } else {
          throw new Error('Failed to remove previous reaction');
        }
      }

      // Optimistic update - update UI immediately
      const updatedPitch = {
        ...currentPitch,
        toastCount: counts.toastCount + 1,
        roastCount: counts.roastCount,
      };

      // Update local state
      setLocalPitches((prevPitches) =>
        prevPitches.map((p) => (p.id === currentPitch.id ? updatedPitch : p))
      );

      // API call in background
      const response = await fetch(`/api/pitches/${currentPitch.id}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'toast' }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to create toast. Status:', response.status, 'Error:', error);
        // Revert optimistic update on error
        setLocalPitches((prevPitches) =>
          prevPitches.map((p) => (p.id === currentPitch.id ? currentPitch : p))
        );
      } else {
        const data = await response.json();
        // Update with actual counts from server
        if (data.counts) {
          const finalPitch = {
            ...updatedPitch,
            roastCount: data.counts.roastCount,
            toastCount: data.counts.toastCount,
          };
          setLocalPitches((prevPitches) =>
            prevPitches.map((p) => (p.id === currentPitch.id ? finalPitch : p))
          );
          setUserReaction('toast');
        } else {
          console.error('CRITICAL: No counts in response. Response data:', data);
          console.error('Response.ok was true but counts missing. This indicates API response format issue.');
        }
      }
    } catch (error) {
      console.error('Error toasting pitch:', error);
    }
  };

  const handleFeedbackSubmit = async (feedback: FeedbackFormData) => {
    if (!currentPitch) return;

    try {
      const response = await fetch(`/api/pitches/${currentPitch.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: feedback.type,
          scores: feedback.scores,
          notes: feedback.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to submit feedback:', error);
      } else {
        // Close feedback panel after successful submission
        setFeedbackPanelOpen(false);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
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
    setFeedbackPanelOpen(true);
  };

  // Notify parent of current pitch changes
  useEffect(() => {
    if (currentPitch && onCurrentPitchChange) {
      onCurrentPitchChange(currentPitch, {
        onRoast: handleRoast,
        onToast: handleToast,
        onOpenFeedback: openFeedback,
        onShare: handleShare,
      });
    }
  }, [currentPitch, onCurrentPitchChange]);

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
      className="relative h-full w-full touch-none overflow-hidden bg-black"
      onWheel={handleWheel}
      {...bind()}
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
            <div className="absolute bottom-24 right-2 z-40 sm:bottom-32 sm:right-3">
              <FloatingReactions
                pitch={currentPitch}
                onRoast={isGuest && onSignInClick ? onSignInClick : handleRoast}
                onToast={isGuest && onSignInClick ? onSignInClick : handleToast}
                onOpenFeedback={isGuest && onSignInClick ? () => onSignInClick() : openFeedback}
                onShare={isGuest && onSignInClick ? onSignInClick : handleShare}
                isGuest={isGuest}
                onSignInClick={onSignInClick}
                userReaction={userReaction}
              />
            </div>
          )}

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

      {/* Quick Feedback Panel */}
      <QuickFeedbackPanel
        isOpen={feedbackPanelOpen}
        onClose={() => setFeedbackPanelOpen(false)}
        onSubmit={handleFeedbackSubmit}
        initialType={feedbackType}
      />

    </div>
  );
}
