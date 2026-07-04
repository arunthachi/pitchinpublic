'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, MessageSquareText, Plus, Wine, X } from 'lucide-react';
import { LegacyFeedback } from '@/types';

interface FeedbackThreadPanelProps {
  isOpen: boolean;
  feedback: LegacyFeedback[];
  onClose: () => void;
  onAddFeedback: (type: 'roast' | 'toast') => void;
}

function averageScore(feedback: LegacyFeedback) {
  const scores = feedback.scores;
  return Math.round(((scores.clarity + scores.solution + scores.market + scores.presentation) / 4) * 10) / 10;
}

export function FeedbackThreadPanel({ isOpen, feedback, onClose, onAddFeedback }: FeedbackThreadPanelProps) {
  const stopPanelEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onPointerDown={stopPanelEvent}
            onTouchMove={stopPanelEvent}
            onWheel={stopPanelEvent}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-white/10 bg-slate-950/96 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:w-[440px]"
            style={{ touchAction: 'pan-y' }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">
                  Founder feedback
                </p>
                <h2 className="mt-1 text-xl font-heading font-bold text-white">
                  {feedback.length ? `${feedback.length} response${feedback.length === 1 ? '' : 's'}` : 'No feedback yet'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] transition-colors hover:bg-white/[0.12]"
                aria-label="Close feedback"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {feedback.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neon-cyan/15 text-neon-cyan">
                    <MessageSquareText className="h-6 w-6" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-white">Be the first useful signal</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Leave a short toast or roast so the founder knows what to sharpen next.
                  </p>
                </div>
              ) : (
                feedback.map((item) => {
                  const isRoast = item.type === 'roast';
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isRoast ? 'bg-roast/15 text-roast' : 'bg-toast/15 text-toast'}`}>
                            {isRoast ? <Flame className="h-5 w-5" /> : <Wine className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{item.authorName}</p>
                            <p className="text-xs text-slate-500">{item.authorRole}</p>
                          </div>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${isRoast ? 'bg-roast/15 text-roast' : 'bg-toast/15 text-toast'}`}>
                          {item.type} {averageScore(item)}/10
                        </div>
                      </div>

                      {item.notes ? (
                        <p className="mt-4 text-sm leading-6 text-slate-200">&ldquo;{item.notes}&rdquo;</p>
                      ) : (
                        <p className="mt-4 text-sm leading-6 text-slate-500">Score-only feedback.</p>
                      )}

                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {[
                          ['Clarity', item.scores.clarity],
                          ['ICP', item.scores.solution],
                          ['Ask', item.scores.market],
                          ['Energy', item.scores.presentation],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl bg-white/[0.06] px-2 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                            <p className="mt-1 font-heading text-lg font-bold text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-slate-950/95 px-4 py-4 shadow-[0_-18px_40px_rgba(2,6,23,0.75)] sm:px-6">
              <button
                onClick={() => onAddFeedback('roast')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-roast/25 bg-roast/15 px-4 py-3 text-sm font-bold text-roast transition-colors hover:bg-roast/20"
              >
                <Plus className="h-4 w-4" />
                Roast
              </button>
              <button
                onClick={() => onAddFeedback('toast')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-toast/25 bg-toast/15 px-4 py-3 text-sm font-bold text-toast transition-colors hover:bg-toast/20"
              >
                <Plus className="h-4 w-4" />
                Toast
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
