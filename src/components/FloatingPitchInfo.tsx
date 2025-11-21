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

export function FloatingPitchInfo({ pitch }: FloatingPitchInfoProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[calc(100%-20px)]"
      >
        {/* Company Name */}
        <h3 className="font-heading font-bold text-white text-lg leading-tight mb-1">
          {pitch.companyName}
        </h3>

        {/* Hook */}
        <p className="text-white/90 text-sm font-medium leading-snug mb-3 font-body">
          {pitch.hook}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white text-xs"
          >
            {pitch.stage}
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white text-xs"
          >
            {pitch.industry}
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white gap-1 text-xs"
          >
            <Eye className="w-3 h-3" />
            {formatNumber(pitch.views)}
          </Badge>
        </div>
      </motion.div>
    </div>
  );
}
