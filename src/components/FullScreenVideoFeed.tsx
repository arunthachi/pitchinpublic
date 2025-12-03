'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

  const currentPitch = pitches[currentIndex];
  const hasNext = currentIndex < pitches.length - 1;
  const hasPrev = currentIndex > 0;

  // Handle empty pitches array
  if (!pitches.length || !currentPitch) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-white/60 text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>Loading pitches...</p>
        </div>
      </div>
    );
  }

  const goToNext = useCallback(() => {
    if (hasNext) {
      setDirection('down');
      setCurrentIndex((prev) => prev + 1);
    }
  }, [hasNext]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setDirection('up');
      setCurrentIndex((prev) => prev - 1);
    }
  }, [hasPrev]);

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

  const handleRoast = () => {
    console.log('Roasted!');
    // In production, this would update the backend
  };

  const handleToast = () => {
    console.log('Toasted!');
    // In production, this would update the backend
  };

  const handleFeedbackSubmit = (feedback: FeedbackFormData) => {
    console.log('Feedback submitted:', feedback);
    // In production, this would send to backend
  };

  const handleShare = () => {
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
    if (onCurrentPitchChange) {
      onCurrentPitchChange(currentPitch, {
        onRoast: handleRoast,
        onToast: handleToast,
        onOpenFeedback: openFeedback,
        onShare: handleShare,
      });
    }
  }, [currentPitch, onCurrentPitchChange]);

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
    <div className="relative w-full h-full bg-black overflow-hidden" {...bind()}>
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

          {/* Floating Info */}
          <FloatingPitchInfo pitch={currentPitch} />

          {/* Floating Reactions - positioned on right side like TikTok */}
          {!hideReactions && (
            <div className="absolute right-3 bottom-40 z-40">
              <FloatingReactions
                pitch={currentPitch}
                onRoast={isGuest && onSignInClick ? onSignInClick : handleRoast}
                onToast={isGuest && onSignInClick ? onSignInClick : handleToast}
                onOpenFeedback={isGuest && onSignInClick ? () => onSignInClick() : openFeedback}
                onShare={isGuest && onSignInClick ? onSignInClick : handleShare}
                isGuest={isGuest}
                onSignInClick={onSignInClick}
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
