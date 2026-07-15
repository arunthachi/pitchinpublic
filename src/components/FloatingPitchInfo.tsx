'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LegacyPitch } from '@/types';
import { ChevronUp, Target } from 'lucide-react';
import { getTakeLabel } from '@/lib/pitch-copy';

interface FloatingPitchInfoProps {
  pitch: LegacyPitch;
  onAvatarClick?: () => void;
  reserveActionRail?: boolean;
}

export function FloatingPitchInfo({ pitch, reserveActionRail = true }: FloatingPitchInfoProps) {
  const [expanded, setExpanded] = React.useState(false);
  const isGenericStartup = !pitch.companyName || ['startup', 'practice pitch'].includes(pitch.companyName.trim().toLowerCase());
  const oneLine = pitch.hook?.trim();
  const feedbackAsk = pitch.feedbackAsk?.trim();
  const normalizedCompany = pitch.companyName?.trim().toLowerCase() || '';
  const normalizedHook = oneLine?.toLowerCase() || '';
  const normalizedAsk = feedbackAsk?.toLowerCase() || '';
  const collapsedTitle = isGenericStartup ? oneLine || 'Pitch take' : pitch.companyName;
  const collapsedMeta = [
    getTakeLabel(pitch.versionNumber, pitch.isBestTake),
    feedbackAsk && normalizedAsk !== normalizedHook ? `Ask: ${feedbackAsk}` : null,
    oneLine && normalizedHook !== normalizedCompany && normalizedHook !== normalizedAsk ? oneLine : null,
  ].filter(Boolean).join(' · ');
  const shouldRenderCollapsed = Boolean(collapsedTitle || collapsedMeta);

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
            className="glass-panel pointer-events-auto overflow-hidden rounded-[1.6rem]"
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
                <span className="glass-pill rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neon-lime">
                  {getTakeLabel(pitch.versionNumber, pitch.isBestTake)}
                </span>
                <span className="glass-pill rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neon-cyan">
                  {pitch.stage}
                </span>
                <span className="glass-pill rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-100">
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

              {feedbackAsk && (
                <div className="mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-white/[0.86]">
                  <Target size={14} className="mt-0.5 shrink-0 text-neon-lime" />
                  <span className="text-xs leading-snug">
                    Feedback ask: {feedbackAsk}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          shouldRenderCollapsed && (
            <motion.button
              key="collapsed-pitch-info"
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={() => setExpanded(true)}
              className="glass-pill pointer-events-auto flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition hover:border-white/25 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-neon-cyan/70"
              aria-expanded={expanded}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon-cyan text-black shadow-[0_0_22px_rgba(0,230,246,0.35)]">
                <Target size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold leading-tight text-white">
                  {collapsedTitle}
                </span>
                <span className="block truncate text-xs leading-tight text-white/72">
                  {collapsedMeta}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.12] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
                More
                <ChevronUp size={12} />
              </span>
            </motion.button>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
