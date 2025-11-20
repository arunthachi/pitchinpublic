'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, MessageCircle, Share2, BarChart3 } from 'lucide-react';
import { Pitch } from '@/types';
import { formatNumber } from '@/lib/utils';

interface FloatingReactionsProps {
  pitch: Pitch;
  onRoast: () => void;
  onToast: () => void;
  onOpenFeedback: () => void;
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

  const handleRoast = () => {
    setJustRoasted(true);
    onRoast();
    setTimeout(() => setJustRoasted(false), 1000);
  };

  const handleToast = () => {
    setJustToasted(true);
    onToast();
    setTimeout(() => setJustToasted(false), 1000);
  };

  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-4">
      {/* Roast Button */}
      <motion.button
        onClick={handleRoast}
        whileTap={{ scale: 0.9 }}
        className="relative flex flex-col items-center gap-1"
      >
        <motion.div
          animate={justRoasted ? { scale: [1, 1.3, 1] } : {}}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            justRoasted
              ? 'bg-roast shadow-[0_0_30px_rgba(255,59,48,0.6)]'
              : 'bg-slate-900/80 backdrop-blur-md border-2 border-slate-700 hover:border-roast'
          }`}
        >
          <Flame
            className={`w-7 h-7 transition-colors ${
              justRoasted ? 'text-white' : 'text-roast'
            }`}
          />
        </motion.div>
        <span className="text-xs font-bold text-white font-heading">
          {formatNumber(pitch.roastCount + (justRoasted ? 1 : 0))}
        </span>

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

      {/* Toast Button */}
      <motion.button
        onClick={handleToast}
        whileTap={{ scale: 0.9 }}
        className="relative flex flex-col items-center gap-1"
      >
        <motion.div
          animate={justToasted ? { scale: [1, 1.3, 1] } : {}}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            justToasted
              ? 'bg-toast shadow-[0_0_30px_rgba(52,199,89,0.6)]'
              : 'bg-slate-900/80 backdrop-blur-md border-2 border-slate-700 hover:border-toast'
          }`}
        >
          <Sparkles
            className={`w-7 h-7 transition-colors ${
              justToasted ? 'text-white' : 'text-toast'
            }`}
          />
        </motion.div>
        <span className="text-xs font-bold text-white font-heading">
          {formatNumber(pitch.toastCount + (justToasted ? 1 : 0))}
        </span>

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

      {/* Feedback Button */}
      <motion.button
        onClick={onOpenFeedback}
        whileTap={{ scale: 0.9 }}
        className="flex flex-col items-center gap-1"
      >
        <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md border-2 border-slate-700 hover:border-neon-cyan flex items-center justify-center transition-all">
          <MessageCircle className="w-7 h-7 text-slate-300" />
        </div>
        <span className="text-xs font-bold text-white font-heading">
          {pitch.feedback?.length || 0}
        </span>
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
