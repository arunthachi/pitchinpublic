'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Pitch } from '@/types';
import { Music } from 'lucide-react';

interface FloatingPitchInfoProps {
  pitch: Pitch;
  onAvatarClick?: () => void;
}

export function FloatingPitchInfo({ pitch }: FloatingPitchInfoProps) {
  return (
    <div className="absolute bottom-20 left-0 right-16 z-30 px-4 pb-4 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* Founder Name (like TikTok username) */}
        <h3 className="font-bold text-white text-base leading-tight">
          {pitch.founderName}
        </h3>

        {/* Caption Text - Company + Hook */}
        <p className="text-white text-sm leading-relaxed pr-2">
          {pitch.companyName}: {pitch.hook}
        </p>

        {/* Audio/Music Info */}
        <div className="flex items-center gap-2 text-white/90">
          <Music size={14} />
          <span className="text-xs">
            Original pitch · {pitch.stage} · {pitch.industry}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
