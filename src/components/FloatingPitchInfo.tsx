'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LegacyPitch } from '@/types';
import { ChevronUp, Target } from 'lucide-react';

interface FloatingPitchInfoProps {
  pitch: LegacyPitch;
  onAvatarClick?: () => void;
  reserveActionRail?: boolean;
}

export function FloatingPitchInfo({ pitch, reserveActionRail = true }: FloatingPitchInfoProps) {
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    setExpanded(false);
  }, [pitch.id]);

  return (
    <div
      className={`absolute left-0 z-50 px-3 pb-4 ${
        reserveActionRail ? 'right-[4.35rem]' : 'right-0'
      } bottom-24 lg:bottom-9`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.div
            key="expanded-pitch-info"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="pointer-events-auto overflow-hidden rounded-[1.6rem] border border-white/[0.16] bg-black/[0.52] shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex w-full items-center justify-center pt-2 text-white/60 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/70"
              aria-label="Collapse pitch context"
            >
              <span className="h-1 w-10 rounded-full bg-white/40" />
            </button>

            <div className="px-3 pb-3 pt-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/[0.14] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neon-cyan">
                  {pitch.stage}
                </span>
                <span className="rounded-full bg-white/[0.14] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-100">
                  {pitch.industry}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold leading-tight text-white">
                  {pitch.founderName}
                  <span className="font-medium text-slate-300"> pitching </span>
                  {pitch.companyName}
                </p>
                <p className="line-clamp-2 text-sm leading-snug text-white/[0.92]">
                  {pitch.hook}
                </p>
              </div>

              <div className="mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-white/[0.86]">
                <Target size={14} className="mt-0.5 shrink-0 text-neon-lime" />
                <span className="text-xs leading-snug">
                  Feedback ask: help sharpen ICP, clarity, and closing ask.
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed-pitch-info"
            type="button"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={() => setExpanded(true)}
            className="pointer-events-auto flex w-full items-center gap-2 rounded-full border border-white/[0.14] bg-black/[0.38] px-3 py-2 text-left shadow-2xl shadow-black/35 backdrop-blur-xl transition hover:border-white/25 hover:bg-black/[0.5] focus:outline-none focus:ring-2 focus:ring-neon-cyan/70"
            aria-expanded={expanded}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon-cyan text-black">
              <Target size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold leading-tight text-white">
                {pitch.companyName}
              </span>
              <span className="block truncate text-xs leading-tight text-white/72">
                Ask: sharpen ICP, clarity, and close
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.12] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
              More
              <ChevronUp size={12} />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
