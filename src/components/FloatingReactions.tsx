'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Wine, Share2, BarChart3, Plus, Bookmark } from 'lucide-react';
import { LegacyPitch } from '@/types';
import { formatNumber } from '@/lib/utils';

interface FloatingReactionsProps {
  pitch: LegacyPitch;
  onRoast: () => void;
  onToast: () => void;
  onOpenFeedback: (type: 'roast' | 'toast') => void;
  onShare: () => void;
  onBookmark?: (isBookmarked: boolean) => void;
  isGuest?: boolean;
  onSignInClick?: () => void;
  isBookmarked?: boolean;
  bookmarkCount?: number;
}

export function FloatingReactions({
  pitch,
  onRoast,
  onToast,
  onOpenFeedback,
  onShare,
  onBookmark,
  isGuest = false,
  onSignInClick,
  isBookmarked = false,
  bookmarkCount = 0,
}: FloatingReactionsProps) {
  const [justRoasted, setJustRoasted] = useState(false);
  const [justToasted, setJustToasted] = useState(false);
  const [bookmarkState, setBookmarkState] = useState(isBookmarked);

  const handleRoastClick = () => {
    setJustRoasted(true);
    onRoast();
    setTimeout(() => setJustRoasted(false), 1000);
  };

  const handleRoastLongPress = () => {
    onOpenFeedback('roast');
  };

  const handleToastClick = () => {
    setJustToasted(true);
    onToast();
    setTimeout(() => setJustToasted(false), 1000);
  };

  const handleToastLongPress = () => {
    onOpenFeedback('toast');
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

  return (
    <div className="flex flex-col gap-4 items-center">
      {/* Founder Avatar - Like TikTok profile */}
      <div className="relative mb-2">
        <motion.img
          whileTap={{ scale: 0.95 }}
          src={pitch.founderAvatar}
          alt={pitch.founderName}
          className="w-12 h-12 rounded-full border-2 border-white cursor-pointer shadow-lg"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
        />
        {/* Follow Button */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-neon-cyan rounded-full flex items-center justify-center cursor-pointer shadow-lg border border-white">
          <Plus className="w-3 h-3 text-slate-900" strokeWidth={3} />
        </div>
      </div>

      {/* Roast Button - Tap for quick roast, hold for detailed feedback */}
      <motion.button
        onClick={handleRoastClick}
        onDoubleClick={handleRoastLongPress}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <motion.div
          animate={justRoasted ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 w-16 h-16 bg-roast/10 rounded-full blur-sm"
            animate={justRoasted ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : {}}
          />

          {/* Main circular button background */}
          <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-roast/40 hover:border-roast/70 transition-all duration-200 hover:bg-black/70 shadow-xl hover:shadow-[0_0_20px_rgba(255,59,48,0.4)]">
            <Flame
              className={`w-8 h-8 transition-all duration-300 ${
                justRoasted ? 'text-roast drop-shadow-[0_0_12px_rgba(255,59,48,0.8)]' : 'text-white group-hover:text-roast'
              }`}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              strokeWidth={1.5}
            />

            {/* Comment count badge */}
            {pitch.feedback && pitch.feedback.filter(f => f.type === 'roast').length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-roast rounded-full flex items-center justify-center shadow-lg border border-white/50">
                <span className="text-[10px] font-bold text-white">
                  {pitch.feedback.filter(f => f.type === 'roast').length}
                </span>
              </div>
            )}
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {formatNumber(pitch.roastCount + (justRoasted ? 1 : 0))}
          </span>
        </div>

        <AnimatePresence>
          {justRoasted && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -50, scale: 1.5 }}
              exit={{ opacity: 0 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <Flame className="w-8 h-8 text-roast" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Toast Button - Tap for quick toast, hold for detailed feedback */}
      <motion.button
        onClick={handleToastClick}
        onDoubleClick={handleToastLongPress}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <motion.div
          animate={justToasted ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 w-16 h-16 bg-toast/10 rounded-full blur-sm"
            animate={justToasted ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : {}}
          />

          {/* Main circular button background */}
          <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-toast/40 hover:border-toast/70 transition-all duration-200 hover:bg-black/70 shadow-xl hover:shadow-[0_0_20px_rgba(52,199,89,0.4)]">
            <Wine
              className={`w-8 h-8 transition-all duration-300 ${
                justToasted ? 'text-toast drop-shadow-[0_0_12px_rgba(52,199,89,0.8)]' : 'text-white group-hover:text-toast'
              }`}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              strokeWidth={1.5}
            />

            {/* Comment count badge */}
            {pitch.feedback && pitch.feedback.filter(f => f.type === 'toast').length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-toast rounded-full flex items-center justify-center shadow-lg border border-white/50">
                <span className="text-[10px] font-bold text-white">
                  {pitch.feedback.filter(f => f.type === 'toast').length}
                </span>
              </div>
            )}
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {formatNumber(pitch.toastCount + (justToasted ? 1 : 0))}
          </span>
        </div>

        <AnimatePresence>
          {justToasted && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -50, scale: 1.5 }}
              exit={{ opacity: 0 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <Wine className="w-8 h-8 text-toast" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Bookmark Button - Save pitch for later */}
      <motion.button
        onClick={handleBookmarkClick}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <motion.div
          animate={bookmarkState ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 w-16 h-16 bg-neon-cyan/10 rounded-full blur-sm"
            animate={bookmarkState ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : {}}
          />

          {/* Main circular button background */}
          <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-neon-cyan/40 hover:border-neon-cyan/70 transition-all duration-200 hover:bg-black/70 shadow-xl hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            <Bookmark
              className={`w-8 h-8 transition-all duration-300 ${
                bookmarkState
                  ? 'text-neon-cyan fill-neon-cyan drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]'
                  : 'text-white group-hover:text-neon-cyan'
              }`}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              strokeWidth={1.5}
            />
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {formatNumber(bookmarkCount)}
          </span>
        </div>
      </motion.button>

      {/* Share Button */}
      <motion.button
        onClick={onShare}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-slate-400/40 hover:border-slate-400/70 transition-all duration-200 hover:bg-black/70 shadow-xl hover:shadow-[0_0_20px_rgba(203,213,225,0.3)]">
          <Share2
            className="w-7 h-7 text-white group-hover:text-slate-200 transition-all duration-300"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            strokeWidth={1.5}
          />
        </div>
      </motion.button>

      {/* Score Badge */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="relative w-14 h-14 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-neon-cyan/40 hover:border-neon-cyan/70 transition-all duration-200 hover:bg-black/70 shadow-xl hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
        >
          <BarChart3
            className="w-7 h-7 text-white hover:text-neon-cyan transition-all duration-300"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            strokeWidth={1.5}
          />
        </motion.div>
        <span className="text-xs font-bold text-white drop-shadow-md">
          {pitch.interestScore}
        </span>
      </div>
    </div>
  );
}
