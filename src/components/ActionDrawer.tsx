'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Wine, Share2, MoreVertical, Plus, Bookmark, X } from 'lucide-react';
import { LegacyPitch } from '@/types';
import { formatNumber } from '@/lib/utils';

interface ActionDrawerProps {
  pitch: LegacyPitch;
  onRoast: () => void;
  onToast: () => void;
  onOpenFeedback: (type: 'roast' | 'toast') => void;
  onShare: () => void;
  onBookmark?: (isBookmarked: boolean) => void;
  isGuest?: boolean;
  onSignInClick?: () => void;
  isBookmarked?: boolean;
  userReaction?: 'roast' | 'toast' | null;
}

export function ActionDrawer({
  pitch,
  onRoast,
  onToast,
  onOpenFeedback,
  onShare,
  onBookmark,
  isGuest = false,
  onSignInClick,
  isBookmarked = false,
  userReaction = null,
}: ActionDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarkState, setBookmarkState] = useState(isBookmarked);
  const dragX = useRef(0);

  // Fetch follow status on mount
  React.useEffect(() => {
    const fetchFollowStatus = async () => {
      try {
        const response = await fetch(`/api/users/${pitch.userId}/follow`);
        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.isFollowing);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    if (!isGuest && isOpen) {
      fetchFollowStatus();
    }
  }, [pitch.userId, isGuest, isOpen]);

  const handleFollowClick = async () => {
    if (isGuest && onSignInClick) {
      onSignInClick();
      return;
    }

    setIsLoadingFollow(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/users/${pitch.userId}/follow`, {
        method,
      });

      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.isFollowing);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleRoastClick = () => {
    onRoast();
  };

  const handleToastClick = () => {
    onToast();
  };

  const handleBookmarkClick = () => {
    if (isGuest && onSignInClick) {
      onSignInClick();
      return;
    }

    const newBookmarkState = !bookmarkState;
    setBookmarkState(newBookmarkState);
    onBookmark?.(newBookmarkState);
  };

  const handleDragStart = (e: React.TouchEvent) => {
    dragX.current = e.touches[0].clientX;
  };

  const handleDragEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const diff = dragX.current - endX;

    // If dragged more than 50px to the left, close drawer
    if (diff > 50) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Drawer Toggle Button - Right Edge */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 bottom-8 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-cyan/60 flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
        title="Open actions menu"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90 }} animate={{ rotate: 0 }} exit={{ rotate: 90 }}>
              <X className="w-5 h-5 text-slate-900" strokeWidth={3} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90 }} animate={{ rotate: 0 }} exit={{ rotate: -90 }}>
              <MoreVertical className="w-5 h-5 text-slate-900" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Semi-transparent Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      {/* Drawer Panel - Slides in from right */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
            className="fixed right-0 top-0 bottom-0 w-80 bg-gradient-to-b from-slate-950 via-slate-900 to-black z-40 shadow-2xl flex flex-col"
          >
            {/* Close Button Inside Drawer */}
            <motion.button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </motion.button>

            {/* Creator Card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="p-6 border-b border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={pitch.founderAvatar}
                  alt={pitch.founderName}
                  className="w-14 h-14 rounded-full border-2 border-neon-cyan shadow-lg"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm">{pitch.founderName}</h3>
                  <p className="text-xs text-white/60">{formatNumber(15000)} followers</p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleFollowClick}
                disabled={isLoadingFollow}
                className={`w-full py-2 rounded-lg font-semibold text-sm transition-all ${
                  isFollowing
                    ? 'bg-neon-lime text-slate-900 hover:bg-neon-lime/90'
                    : 'bg-neon-cyan text-slate-900 hover:bg-neon-cyan/90'
                } ${isLoadingFollow ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoadingFollow ? 'Loading...' : isFollowing ? '✓ Following' : '+ Follow'}
              </motion.button>
            </motion.div>

            {/* Pitch Hook */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="p-6 border-b border-white/10"
            >
              <p className="text-white text-sm font-medium leading-relaxed">{pitch.hook}</p>
            </motion.div>

            {/* Engagement Metrics */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex-1 p-6 space-y-4"
            >
              {/* Roast */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleRoastClick}
                onDoubleClick={() => onOpenFeedback('roast')}
                className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all border ${
                  userReaction === 'roast'
                    ? 'bg-roast/20 border-roast/60'
                    : 'bg-black/40 border-white/10 hover:border-roast/40'
                }`}
              >
                <Flame className={`w-6 h-6 flex-shrink-0 ${userReaction === 'roast' ? 'text-roast' : 'text-white/60'}`} />
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{formatNumber(pitch.roastCount)}</div>
                  <div className="text-xs text-white/60">Roasts</div>
                </div>
                <span className="text-xs text-white/60 font-mono">Double tap for feedback</span>
              </motion.button>

              {/* Toast */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleToastClick}
                onDoubleClick={() => onOpenFeedback('toast')}
                className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all border ${
                  userReaction === 'toast'
                    ? 'bg-toast/20 border-toast/60'
                    : 'bg-black/40 border-white/10 hover:border-toast/40'
                }`}
              >
                <Wine className={`w-6 h-6 flex-shrink-0 ${userReaction === 'toast' ? 'text-toast' : 'text-white/60'}`} />
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{formatNumber(pitch.toastCount)}</div>
                  <div className="text-xs text-white/60">Toasts</div>
                </div>
                <span className="text-xs text-white/60 font-mono">Double tap for feedback</span>
              </motion.button>

              {/* Views */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-black/40 border border-white/10">
                <span className="text-2xl">👁️</span>
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{formatNumber(pitch.views)}</div>
                  <div className="text-xs text-white/60">Views</div>
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-black/40 border border-white/10">
                <span className="text-2xl">📊</span>
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{formatNumber(pitch.interestScore)}</div>
                  <div className="text-xs text-white/60">Interest Score</div>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="p-6 border-t border-white/10 space-y-2"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onShare}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/10 hover:border-white/30 transition-all text-white"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-sm font-medium">Share Pitch</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleBookmarkClick}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all border ${
                  bookmarkState
                    ? 'bg-neon-cyan/10 border-neon-cyan/60 text-neon-cyan'
                    : 'bg-black/40 border-white/10 hover:border-neon-cyan/40 text-white'
                }`}
              >
                <Bookmark className={`w-5 h-5 ${bookmarkState ? 'fill-current' : ''}`} />
                <span className="text-sm font-medium">{bookmarkState ? 'Bookmarked' : 'Bookmark'}</span>
              </motion.button>
            </motion.div>

            {/* Footer Hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="px-6 py-3 text-center text-xs text-white/40 border-t border-white/5"
            >
              Drag left or tap × to close
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
