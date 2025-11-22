'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, TrendingUp, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LegacyPitch } from '@/types';
import { formatNumber } from '@/lib/utils';

interface PitchCardProps {
  pitch: LegacyPitch;
  index?: number;
}

export function PitchCard({ pitch, index = 0 }: PitchCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
      <Link href={`/pitch/${pitch.id}`}>
        <Card className="h-full overflow-hidden border-slate-800 hover:border-neon-cyan/50 transition-all duration-300 group cursor-pointer bg-slate-900/80 backdrop-blur-md">
          {/* Video Thumbnail */}
          <div className="relative aspect-video overflow-hidden bg-slate-800">
            <img
              src={pitch.thumbnailUrl}
              alt={pitch.companyName}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />

            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-16 h-16 rounded-full bg-neon-cyan/90 flex items-center justify-center">
                <Play className="w-8 h-8 text-slate-900 fill-slate-900 ml-1" />
              </div>
            </div>

            {/* Badges overlay */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="secondary" className="backdrop-blur-sm">
                {pitch.stage}
              </Badge>
              <Badge variant="outline" className="backdrop-blur-sm">
                {pitch.industry}
              </Badge>
            </div>

            {/* Stats overlay */}
            <div className="absolute bottom-3 right-3 flex gap-3">
              <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-md">
                <Eye className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-200">
                  {formatNumber(pitch.views)}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-neon-cyan/20 backdrop-blur-sm px-2 py-1 rounded-md border border-neon-cyan/30">
                <TrendingUp className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-bold text-neon-cyan">
                  {pitch.interestScore}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="p-4 space-y-3">
            {/* Founder info */}
            <div className="flex items-center gap-3">
              <img
                src={pitch.founderAvatar}
                alt={pitch.founderName}
                className="w-10 h-10 rounded-full border-2 border-slate-700"
              />
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-100 leading-tight">
                  {pitch.companyName}
                </h3>
                <p className="text-sm text-slate-400 font-body">
                  {pitch.founderName}
                </p>
              </div>
            </div>

            {/* Hook */}
            <p className="text-slate-200 font-medium leading-snug line-clamp-2 font-body">
              {pitch.hook}
            </p>

            {/* Feedback count */}
            {pitch.feedback && pitch.feedback.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 font-body">
                  {pitch.feedback.length} feedback{pitch.feedback.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
