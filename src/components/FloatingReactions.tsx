'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Wine, Share2, BarChart3, Plus } from 'lucide-react';
import { LegacyPitch } from '@/types';
import { formatNumber } from '@/lib/utils';

interface FloatingReactionsProps {
  pitch: LegacyPitch;
  onRoast: () => void;
  onToast: () => void;
  onOpenFeedback: (type: 'roast' | 'toast') => void;
  onShare: () => void;
  isGuest?: boolean;
  onSignInClick?: () => void;
}

export function FloatingReactions({
  pitch,
  onRoast,
  onToast,
  onOpenFeedback,
  onShare,
  isGuest = false,
  onSignInClick,
}: FloatingReactionsProps) {
  const [justRoasted, setJustRoasted] = useState(false);
  const [justToasted, setJustToasted] = useState(false);

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

  return (
    <div className="flex flex-col gap-4 items-center">
      {/* Founder Avatar - Like TikTok profile */}
      <div className="relative mb-2">
        <motion.img
          whileTap={{ scale: 0.95 }}
          src={pitch.founderAvatar}
          alt={pitch.founderName}
          className="w-12 h-12 rounded-full border border-white/80 cursor-pointer shadow-lg"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
        />
        {/* Follow Button */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-neon-cyan rounded-full flex items-center justify-center cursor-pointer shadow-md">
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
          <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-roast/20 to-roast/10 border border-roast/30 hover:border-roast/50 transition-all duration-200 group-hover:from-roast/30 group-hover:to-roast/15 shadow-lg hover:shadow-[0_0_20px_rgba(255,59,48,0.3)]">
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
          <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-toast/20 to-toast/10 border border-toast/30 hover:border-toast/50 transition-all duration-200 group-hover:from-toast/30 group-hover:to-toast/15 shadow-lg hover:shadow-[0_0_20px_rgba(52,199,89,0.3)]">
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

      {/* Share Button */}
      <motion.button
        onClick={onShare}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-slate-300/10 to-slate-400/5 border border-slate-300/20 hover:border-slate-300/40 transition-all duration-200 group-hover:from-slate-300/15 group-hover:to-slate-400/10 shadow-lg hover:shadow-[0_0_20px_rgba(203,213,225,0.2)]">
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
          className="relative w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan/10 to-neon-cyan/5 border border-neon-cyan/20 hover:border-neon-cyan/40 transition-all duration-200 hover:from-neon-cyan/15 hover:to-neon-cyan/10 shadow-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]"
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
