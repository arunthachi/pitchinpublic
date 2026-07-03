'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Share2, Video } from 'lucide-react';

interface Step3_PublishProps {
  pitchTitle: string;
  previewUrl: string;
  videoDuration: number;
  onViewFeed: () => void;
  onShare?: () => void;
  isLoading?: boolean;
}

export function Step3_Publish({
  pitchTitle,
  previewUrl,
  videoDuration,
  onViewFeed,
  onShare,
  isLoading = false,
}: Step3_PublishProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 text-center"
    >
      {/* Success Animation */}
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="w-16 h-16 bg-gradient-to-br from-neon-cyan to-neon-lime rounded-full flex items-center justify-center"
        >
          <Check className="w-8 h-8 text-slate-900" />
        </motion.div>
      </div>

      {/* Success Message */}
      <div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white mb-2"
        >
          Pitch published
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400"
        >
          Your pitch is live and ready for Toast/Roast feedback.
        </motion.p>
      </div>

      {/* Pitch Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <div className="relative mx-auto aspect-[9/16] max-h-[min(32dvh,340px)] overflow-hidden rounded-2xl border border-white/10 bg-black">
          <video
            src={previewUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
          <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            {formatTime(videoDuration)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-lime/15 text-neon-lime">
              <Video className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white line-clamp-2">{pitchTitle}</p>
              <p className="mt-0.5 text-sm text-slate-400">{formatTime(videoDuration)} published</p>
            </div>
            <div className="rounded-full border border-neon-lime/25 bg-neon-lime/10 px-3 py-1 text-xs font-bold text-neon-lime">
              Live
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3 pt-4"
      >
        {/* Share Button */}
        {onShare && (
          <button
            onClick={onShare}
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-neon-cyan/20 to-neon-lime/20 border border-neon-cyan/50 text-white font-semibold rounded-xl hover:border-neon-cyan hover:from-neon-cyan/30 hover:to-neon-lime/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Share2 className="w-5 h-5" />
            Share Your Pitch
          </button>
        )}

        {/* View Feed Button */}
        <button
          onClick={onViewFeed}
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Opening feed...
            </span>
          ) : (
            'View Feed'
          )}
        </button>
      </motion.div>

      {/* Stats Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-3 gap-3 pt-4"
      >
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-neon-cyan">0</div>
          <div className="text-xs text-slate-400 mt-1">Views</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-roast">0</div>
          <div className="text-xs text-slate-400 mt-1">Roasts</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-toast">0</div>
          <div className="text-xs text-slate-400 mt-1">Toasts</div>
        </div>
      </motion.div>

      {/* Engagement Tip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mt-6"
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold">Pro tip:</span> Give feedback on another founder&apos;s pitch to increase the odds of getting thoughtful feedback back.
        </p>
      </motion.div>
    </motion.div>
  );
}
