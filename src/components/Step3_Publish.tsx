'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Share2, X } from 'lucide-react';

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
          Pitch Posted! 🎉
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400"
        >
          Your pitch is now live and visible to the community
        </motion.p>
      </div>

      {/* Pitch Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <div className="relative aspect-[9/16] max-h-[35vh] mx-auto bg-black rounded-xl overflow-hidden">
          <video
            src={previewUrl}
            controls
            className="w-full h-full object-contain"
          />
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded-full">
            <span className="text-xs text-white font-medium">{videoDuration}s</span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 text-left">
          <p className="text-sm text-slate-400 mb-1">Your pitch:</p>
          <p className="text-white font-semibold line-clamp-3">{pitchTitle}</p>
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
          View Feed
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
          💡 <span className="font-semibold">Pro tip:</span> Share your pitch to get more views and feedback from the community!
        </p>
      </motion.div>
    </motion.div>
  );
}
