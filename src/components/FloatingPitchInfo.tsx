'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LegacyPitch } from '@/types';
import { Music } from 'lucide-react';

interface FloatingPitchInfoProps {
  pitch: LegacyPitch;
  onAvatarClick?: () => void;
}

export function FloatingPitchInfo({ pitch }: FloatingPitchInfoProps) {
  return (
    <div className="absolute bottom-20 left-0 right-16 z-30 px-4 pb-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        {/* Founder Name (like TikTok username) */}
        <h3
          className="font-bold text-white text-base leading-tight"
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)'
          }}
        >
          {pitch.founderName}
        </h3>

        {/* Caption Text - Company + Hook */}
        <p
          className="text-white text-sm leading-relaxed pr-2"
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)'
          }}
        >
          {pitch.companyName}: {pitch.hook}
        </p>

        {/* Audio/Music Info */}
        <div
          className="flex items-center gap-2 text-white/90"
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.6)'
          }}
        >
          <Music
            size={14}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
          />
          <span className="text-xs">
            Original pitch · {pitch.stage} · {pitch.industry}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
