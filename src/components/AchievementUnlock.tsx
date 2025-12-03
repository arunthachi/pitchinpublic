'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface AchievementUnlockProps {
  badgeIcon: string;
  badgeName: string;
  badgeDescription: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AchievementUnlock({
  badgeIcon,
  badgeName,
  badgeDescription,
  isOpen,
  onClose,
}: AchievementUnlockProps) {
  // Auto-close after 4 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 100 }}
          transition={{ type: 'spring', damping: 20, stiffness: 150 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        >
          {/* Confetti background */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, y: 0, x: 0 }}
                animate={{
                  opacity: 0,
                  y: -100,
                  x: (Math.random() - 0.5) * 100,
                }}
                transition={{
                  duration: 2.5,
                  delay: i * 0.1,
                  ease: 'easeOut',
                }}
                className="absolute text-2xl"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {['🌟', '✨', '🎉', '🎊', '⭐'][i % 5]}
              </motion.div>
            ))}
          </div>

          {/* Main card */}
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 border border-neon-lime/50 rounded-2xl p-6 shadow-2xl shadow-neon-lime/20 max-w-sm">
            {/* Glow effect */}
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-neon-lime/20 to-neon-cyan/20 blur-xl"
            />

            {/* Content */}
            <div className="relative text-center space-y-4">
              {/* Icon */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex justify-center"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-neon-lime/30 to-neon-cyan/30 rounded-full flex items-center justify-center border border-neon-lime/50">
                  <span className="text-5xl">{badgeIcon}</span>
                </div>
              </motion.div>

              {/* Header */}
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-neon-lime" />
                  <p className="text-neon-lime font-bold text-sm uppercase tracking-wider">
                    Achievement Unlocked!
                  </p>
                  <Sparkles className="w-4 h-4 text-neon-lime" />
                </div>
              </div>

              {/* Badge name */}
              <h3 className="text-2xl font-bold text-white">{badgeName}</h3>

              {/* Description */}
              <p className="text-slate-300 text-sm">{badgeDescription}</p>

              {/* Progress indication */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 3.5, ease: 'easeInOut' }}
                className="h-1 bg-gradient-to-r from-neon-lime to-neon-cyan rounded-full origin-left"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
