'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, Share2, BarChart3, MessageSquare } from 'lucide-react';
import { Pitch } from '@/types';
import { formatNumber } from '@/lib/utils';

interface FloatingReactionsProps {
  pitch: Pitch;
  onRoast: () => void;
  onToast: () => void;
  onOpenFeedback: (type: 'roast' | 'toast') => void;
  onShare: () => void;
}

export function FloatingReactions({
  pitch,
  onRoast,
  onToast,
  onOpenFeedback,
  onShare,
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
    <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-4">
      {/* Roast Button - Tap for quick roast, hold for detailed feedback */}
      <motion.button
        onClick={handleRoastClick}
        onDoubleClick={handleRoastLongPress}
        whileTap={{ scale: 0.9 }}
        className="relative flex flex-col items-center gap-1 group"
      >
        <motion.div
          animate={justRoasted ? { scale: [1, 1.3, 1] } : {}}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${
            justRoasted
              ? 'bg-roast shadow-[0_0_30px_rgba(255,59,48,0.6)]'
              : 'bg-slate-900/80 backdrop-blur-md border-2 border-roast/50 hover:border-roast hover:bg-roast/10'
          }`}
        >
          <Flame
            className={`w-8 h-8 transition-colors ${
              justRoasted ? 'text-white' : 'text-roast'
            }`}
          />
          {/* Comment count badge */}
          {pitch.feedback && pitch.feedback.filter(f => f.type === 'roast').length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-roast rounded-full flex items-center justify-center border-2 border-black">
              <span className="text-[10px] font-bold text-white">
                {pitch.feedback.filter(f => f.type === 'roast').length}
              </span>
            </div>
          )}
        </motion.div>
        <div className="text-center">
          <span className="text-sm font-bold text-white font-heading block">
            {formatNumber(pitch.roastCount + (justRoasted ? 1 : 0))}
          </span>
          <span className="text-[10px] text-slate-400 font-body">ROAST</span>
        </div>

        <AnimatePresence>
          {justRoasted && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -50, scale: 1.5 }}
              exit={{ opacity: 0 }}
              className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none"
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
        whileTap={{ scale: 0.9 }}
        className="relative flex flex-col items-center gap-1 group"
      >
        <motion.div
          animate={justToasted ? { scale: [1, 1.3, 1] } : {}}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${
            justToasted
              ? 'bg-toast shadow-[0_0_30px_rgba(52,199,89,0.6)]'
              : 'bg-slate-900/80 backdrop-blur-md border-2 border-toast/50 hover:border-toast hover:bg-toast/10'
          }`}
        >
          <Sparkles
            className={`w-8 h-8 transition-colors ${
              justToasted ? 'text-white' : 'text-toast'
            }`}
          />
          {/* Comment count badge */}
          {pitch.feedback && pitch.feedback.filter(f => f.type === 'toast').length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-toast rounded-full flex items-center justify-center border-2 border-black">
              <span className="text-[10px] font-bold text-white">
                {pitch.feedback.filter(f => f.type === 'toast').length}
              </span>
            </div>
          )}
        </motion.div>
        <div className="text-center">
          <span className="text-sm font-bold text-white font-heading block">
            {formatNumber(pitch.toastCount + (justToasted ? 1 : 0))}
          </span>
          <span className="text-[10px] text-slate-400 font-body">TOAST</span>
        </div>

        <AnimatePresence>
          {justToasted && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -50, scale: 1.5 }}
              exit={{ opacity: 0 }}
              className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <Sparkles className="w-8 h-8 text-toast" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Share Button */}
      <motion.button
        onClick={onShare}
        whileTap={{ scale: 0.9 }}
        className="flex flex-col items-center gap-1"
      >
        <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md border-2 border-slate-700 hover:border-neon-lime flex items-center justify-center transition-all">
          <Share2 className="w-7 h-7 text-slate-300" />
        </div>
      </motion.button>

      {/* Score Badge */}
      <div className="flex flex-col items-center gap-1 mt-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-slate-900" />
        </div>
        <span className="text-sm font-bold text-neon-cyan font-heading">
          {pitch.interestScore}
        </span>
      </div>
    </div>
  );
}
