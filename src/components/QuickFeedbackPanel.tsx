'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Wine, CheckCircle2, Target } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FeedbackFormData } from '@/types';

interface QuickFeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackFormData) => boolean | void | Promise<boolean | void>;
  initialType?: 'roast' | 'toast';
}

const toastSignals = ['Clear', 'Compelling', 'Strong problem', 'Strong ask'];
const roastSignals = ['Unclear audience', 'Weak pain', 'Too much jargon', 'Missing ask', 'Not urgent'];
const readinessLevels = [
  { value: 1, label: 'Needs work', helper: 'Core message is not landing yet.' },
  { value: 2, label: 'Getting there', helper: 'Direction is visible, but the pitch needs focus.' },
  { value: 3, label: 'Strong', helper: 'Useful and clear enough for the right room.' },
  { value: 4, label: 'Pitch-ready', helper: 'This version can hold attention under pressure.' },
];

function usePhoneFrameSheetStyle(isOpen: boolean): React.CSSProperties {
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
      const margin = source.width < 520 ? 18 : 24;
      const topReveal = source.width < 620 ? Math.max(72, Math.round(source.height * 0.14)) : 24;
      const left = Math.max(12, source.left + margin);
      const right = Math.min(viewportWidth - 12, source.right - margin);
      const top = Math.max(12, source.top + topReveal);
      const bottom = Math.min(viewportHeight - 12, source.bottom - margin);

      setStyle({
        left,
        top,
        width: Math.max(280, right - left),
        maxHeight: Math.max(360, bottom - top),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isOpen]);

  return style;
}

function readinessToScores(readiness: number) {
  const score = readiness * 2.5;
  return {
    clarity: score,
    solution: score,
    market: score,
    presentation: score,
  };
}

export function QuickFeedbackPanel({ isOpen, onClose, onSubmit, initialType = 'toast' }: QuickFeedbackPanelProps) {
  const [portalNode, setPortalNode] = React.useState<HTMLElement | null>(null);
  const sheetStyle = usePhoneFrameSheetStyle(isOpen);
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>(initialType);
  const [signal, setSignal] = useState(toastSignals[0]);
  const [readiness, setReadiness] = useState(2);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Update feedback type when initialType changes
  React.useEffect(() => {
    if (isOpen) {
      setFeedbackType(initialType);
      setSignal(initialType === 'roast' ? roastSignals[0] : toastSignals[0]);
    }
  }, [initialType, isOpen]);

  const handleSubmit = async () => {
    const trimmedNotes = notes.trim();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await onSubmit({
        type: feedbackType,
        signal,
        readiness,
        scores: readinessToScores(readiness),
        notes: trimmedNotes,
      });
      if (result === false) {
        setSubmitError('Could not save feedback. Please try again.');
        return;
      }

      onClose();
      setReadiness(2);
      setNotes('');
    } catch {
      setSubmitError('Could not save feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRoast = feedbackType === 'roast';
  const activeSignals = isRoast ? roastSignals : toastSignals;
  const stopPanelEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  React.useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-md"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            onPointerDown={stopPanelEvent}
            onTouchMove={stopPanelEvent}
            onWheel={stopPanelEvent}
            className="fixed z-[90] flex flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06)),rgba(8,13,28,0.78)] shadow-[0_34px_110px_rgba(0,0,0,0.62)] ring-1 ring-white/10 backdrop-blur-3xl"
            style={{ ...sheetStyle, touchAction: 'pan-y' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 sm:px-6">
              {/* Header */}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">
                  Builder feedback
                </p>
                <h2 className="mt-1 text-2xl font-heading font-black leading-tight text-white">
                  Help sharpen this pitch
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.10] shadow-lg shadow-black/20 transition-colors hover:bg-white/[0.16]"
                aria-label="Close feedback panel"
              >
                <X className="w-5 h-5 text-slate-200" />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >

              {/* Roast/Toast Toggle */}
              <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-black/20 p-1">
                <button
                  onClick={() => {
                    setFeedbackType('roast');
                    setSignal(roastSignals[0]);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-heading font-black transition-all ${
                    isRoast
                      ? 'bg-roast text-white shadow-lg shadow-roast/20'
                      : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <Flame className="inline-block w-4 h-4 mr-2" />
                  ROAST
                </button>
                <button
                  onClick={() => {
                    setFeedbackType('toast');
                    setSignal(toastSignals[0]);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-heading font-black transition-all ${
                    !isRoast
                      ? 'bg-toast text-white shadow-lg shadow-toast/20'
                      : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <Wine className="inline-block w-4 h-4 mr-2" />
                  TOAST
                </button>
              </div>

              <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <Target className={`h-4 w-4 ${isRoast ? 'text-roast' : 'text-toast'}`} />
                  <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-400">
                    Pick the one signal
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {activeSignals.map((option) => {
                    const selected = signal === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSignal(option)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold transition ${
                          selected
                            ? isRoast
                              ? 'border-roast/60 bg-roast/15 text-white'
                              : 'border-toast/60 bg-toast/15 text-white'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span>{option}</span>
                        {selected && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-400">
                  Readiness
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {readinessLevels.map((level) => {
                    const selected = readiness === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setReadiness(level.value)}
                        className={`rounded-xl border p-3 text-left transition ${
                          selected
                            ? 'border-neon-cyan/70 bg-neon-cyan/15 text-white'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className="block text-sm font-bold">{level.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{level.helper}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-body text-slate-300">
                  Written note <span className="text-slate-500">(optional)</span>
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onPointerDown={stopPanelEvent}
                  onTouchStart={stopPanelEvent}
                  onWheel={stopPanelEvent}
                  placeholder={
                    isRoast
                      ? 'What is unclear, weak, or missing? Be specific and constructive.'
                      : 'What is working, memorable, or worth doubling down on?'
                  }
                  rows={4}
                  className="min-h-[120px] resize-y text-base"
                />
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/28 px-5 py-4 shadow-[0_-18px_40px_rgba(2,6,23,0.55)] sm:px-6">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-6 text-base font-heading font-bold ${
                  isRoast
                    ? 'bg-roast hover:bg-roast/90 text-white'
                    : 'bg-toast hover:bg-toast/90 text-white'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? 'Saving feedback...' : isRoast ? 'Submit constructive roast' : 'Submit useful toast'}
              </Button>
              {submitError && (
                <p className="mt-3 text-center text-sm font-semibold text-roast">
                  {submitError}
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return portalNode ? createPortal(panel, portalNode) : null;
}
