'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, MessageSquareText, Wine, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { LegacyFeedback } from '@/types';

interface FeedbackThreadPanelProps {
  isOpen: boolean;
  feedback: LegacyFeedback[];
  onClose: () => void;
  onAddFeedback: (type: 'roast' | 'toast') => void;
}

function usePhoneFrameSheetStyle(isOpen: boolean, compact = false): React.CSSProperties {
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const frame = document.querySelector('[data-feed-frame="true"]');
      const rect = frame?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const source = rect && rect.width > 0 && rect.height > 0
        ? rect
        : ({ left: 0, top: 0, right: viewportWidth, bottom: viewportHeight, width: viewportWidth, height: viewportHeight } as DOMRect);
      const margin = source.width < 520 ? 16 : 24;
      const topReveal = source.width < 620 ? Math.max(56, Math.round(source.height * 0.12)) : 24;
      const left = Math.max(12, source.left + margin);
      const right = Math.min(viewportWidth - 12, source.right - margin);
      const top = Math.max(12, source.top + topReveal);
      const bottom = Math.min(viewportHeight - 12, source.bottom - margin);
      const availableHeight = Math.max(300, bottom - top);
      const compactHeight = Math.min(availableHeight, source.width < 520 ? 430 : 460);

      setStyle({
        left,
        top,
        width: Math.max(280, right - left),
        height: compact ? compactHeight : availableHeight,
        maxHeight: compact ? compactHeight : availableHeight,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [compact, isOpen]);

  return style;
}

function averageScore(feedback: LegacyFeedback) {
  if (feedback.readiness) return feedback.readiness;
  const scores = feedback.scores;
  return Math.max(1, Math.min(4, Math.round(((scores.clarity + scores.solution + scores.market + scores.presentation) / 4) / 2.5)));
}

function readinessLabel(value: number) {
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

function getMostCommonSignal(feedback: LegacyFeedback[]) {
  const counts = new Map<string, number>();
  feedback.forEach((item) => {
    const signals = item.signals?.length ? item.signals : item.signal ? [item.signal] : [];
    signals.forEach((signal) => {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    });
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
}

function getSignals(feedback: LegacyFeedback) {
  return feedback.signals?.length ? feedback.signals : feedback.signal ? [feedback.signal] : [feedback.type];
}

export function FeedbackThreadPanel({ isOpen, feedback, onClose, onAddFeedback }: FeedbackThreadPanelProps) {
  const [portalNode, setPortalNode] = React.useState<HTMLElement | null>(null);
  const hasFeedback = feedback.length > 0;
  const sheetStyle = usePhoneFrameSheetStyle(isOpen, !hasFeedback);
  const stopPanelEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  React.useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const avgReadiness = hasFeedback
    ? Math.round((feedback.reduce((sum, item) => sum + averageScore(item), 0) / feedback.length) * 10) / 10
    : 0;
  const topSignal = getMostCommonSignal(feedback);
  const toastCount = feedback.filter((item) => item.type === 'toast').length;
  const roastCount = feedback.filter((item) => item.type === 'roast').length;

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/44 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            onPointerDown={stopPanelEvent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-thread-title"
            data-feedback-panel="thread"
            className="glass-panel fixed z-[90] flex flex-col overflow-hidden rounded-[2rem] ring-1 ring-white/10"
            style={{ ...sheetStyle, touchAction: 'pan-y', minHeight: 0 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-white/[0.045] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">
                  Founder feedback
                </p>
                <h2 id="feedback-thread-title" className="mt-1 truncate text-2xl font-heading font-black text-white">
                  {hasFeedback ? `${feedback.length} response${feedback.length === 1 ? '' : 's'}` : 'No feedback yet'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="glass-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.16]"
                aria-label="Close feedback"
              >
                <X className="h-5 w-5 text-slate-200" />
              </button>
            </div>

            <div
              data-feedback-panel-body="thread"
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {!hasFeedback ? (
                <div className="space-y-4">
                  <div className="glass-card rounded-3xl p-5 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neon-cyan/15 text-neon-cyan">
                      <MessageSquareText className="h-6 w-6" />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-white">Be the first useful signal</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Pick Toast or Roast to give this founder a focused signal.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onAddFeedback('roast')}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-roast/30 bg-roast/15 px-4 py-3 text-sm font-black text-roast transition-colors hover:bg-roast/20"
                    >
                      <Flame className="h-4 w-4" />
                      Roast
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddFeedback('toast')}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-toast/30 bg-toast/15 px-4 py-3 text-sm font-black text-toast transition-colors hover:bg-toast/20"
                    >
                      <Wine className="h-4 w-4" />
                      Toast
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="glass-card rounded-3xl border-neon-cyan/20 bg-[linear-gradient(145deg,rgba(0,230,246,0.14),rgba(183,255,42,0.08)),rgba(0,0,0,0.18)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">Coach signal</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Readiness</p>
                        <p className="mt-1 font-heading text-lg font-black text-white">{readinessLabel(avgReadiness)}</p>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Toast</p>
                        <p className="mt-1 font-heading text-lg font-black text-toast">{toastCount}</p>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Roast</p>
                        <p className="mt-1 font-heading text-lg font-black text-roast">{roastCount}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-sm font-semibold text-white">
                        {topSignal
                          ? `${topSignal[1]} builder${topSignal[1] === 1 ? '' : 's'} flagged: ${topSignal[0]}`
                          : 'No repeated signal yet.'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Next rep: tighten the first 10 seconds around the most repeated signal.
                      </p>
                    </div>
                  </div>

                  {feedback.map((item) => {
                    const isRoast = item.type === 'roast';
                    const score = averageScore(item);
                    return (
                      <article
                        key={item.id}
                        className="glass-card rounded-3xl p-4"
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
                            {readinessLabel(score)}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {getSignals(item).map((signal) => (
                            <span
                              key={signal}
                              className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-200"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>

                        {item.notes ? (
                          <p className="mt-3 text-sm leading-6 text-slate-200">&ldquo;{item.notes}&rdquo;</p>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-500">Signal-only coach note.</p>
                        )}
                      </article>
                    );
                  })}
                </>
              )}
            </div>

            {hasFeedback && (
              <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/10 bg-black/24 px-5 py-4 shadow-[0_-18px_40px_rgba(2,6,23,0.55)] sm:px-6">
              <button
                type="button"
                onClick={() => onAddFeedback('roast')}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-roast/30 bg-roast/15 px-4 py-3 text-sm font-black text-roast transition-colors hover:bg-roast/20"
              >
                <Flame className="h-4 w-4" />
                Roast
              </button>
              <button
                type="button"
                onClick={() => onAddFeedback('toast')}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-toast/30 bg-toast/15 px-4 py-3 text-sm font-black text-toast transition-colors hover:bg-toast/20"
              >
                <Wine className="h-4 w-4" />
                Toast
              </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return portalNode ? createPortal(panel, portalNode) : null;
}
