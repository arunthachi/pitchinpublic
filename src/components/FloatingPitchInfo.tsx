'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Pitch } from '@/types';
import { Eye } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface FloatingPitchInfoProps {
  pitch: Pitch;
  onAvatarClick?: () => void;
}

export function FloatingPitchInfo({ pitch, onAvatarClick }: FloatingPitchInfoProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 p-4 pb-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[calc(100%-120px)]"
      >
        {/* Founder Avatar & Name */}
        <div
          className="flex items-center gap-3 mb-3 pointer-events-auto cursor-pointer"
          onClick={onAvatarClick}
        >
          <motion.img
            whileTap={{ scale: 0.95 }}
            src={pitch.founderAvatar}
            alt={pitch.founderName}
            className="w-12 h-12 rounded-full border-2 border-white"
          />
          <div>
            <h3 className="font-heading font-bold text-white text-base leading-tight">
              {pitch.founderName}
            </h3>
            <p className="text-xs text-slate-300 font-body">
              {pitch.companyName}
            </p>
          </div>
        </div>

        {/* Hook */}
        <p className="text-white text-base font-medium leading-snug mb-3 font-body">
          {pitch.hook}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge
            variant="secondary"
            className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white"
          >
            {pitch.stage}
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white"
          >
            {pitch.industry}
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white gap-1"
          >
            <Eye className="w-3 h-3" />
            {formatNumber(pitch.views)}
          </Badge>
        </div>
      </motion.div>
    </div>
  );
}
