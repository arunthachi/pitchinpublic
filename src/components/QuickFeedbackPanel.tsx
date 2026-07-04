'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Wine } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FeedbackFormData } from '@/types';

interface QuickFeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackFormData) => boolean | void | Promise<boolean | void>;
  initialType?: 'roast' | 'toast';
}

export function QuickFeedbackPanel({ isOpen, onClose, onSubmit, initialType = 'toast' }: QuickFeedbackPanelProps) {
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>(initialType);
  const [scores, setScores] = useState({
    clarity: 5,
    solution: 5,
    market: 5,
    presentation: 5,
  });
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Update feedback type when initialType changes
  React.useEffect(() => {
    if (isOpen) {
      setFeedbackType(initialType);
    }
  }, [initialType, isOpen]);

  const handleSubmit = async () => {
    const trimmedNotes = notes.trim();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await onSubmit({ type: feedbackType, scores, notes: trimmedNotes });
      if (result === false) {
        setSubmitError('Could not save feedback. Please try again.');
        return;
      }

      onClose();
      setScores({ clarity: 5, solution: 5, market: 5, presentation: 5 });
      setNotes('');
    } catch {
      setSubmitError('Could not save feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRoast = feedbackType === 'roast';
  const stopPanelEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onPointerDown={stopPanelEvent}
            onTouchMove={stopPanelEvent}
            onWheel={stopPanelEvent}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-white/10 bg-slate-950/96 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:w-[420px]"
            style={{ touchAction: 'pan-y' }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
              {/* Header */}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">
                  Builder feedback
                </p>
                <h2 className="mt-1 text-xl font-heading font-bold text-white">
                  Help sharpen this pitch
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] transition-colors hover:bg-white/[0.12]"
                aria-label="Close feedback panel"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >

              {/* Roast/Toast Toggle */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                <button
                  onClick={() => setFeedbackType('roast')}
                  className={`rounded-xl px-4 py-3 text-sm font-heading font-bold transition-all ${
                    isRoast
                      ? 'bg-roast text-white shadow-lg shadow-roast/20'
                      : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <Flame className="inline-block w-4 h-4 mr-2" />
                  ROAST
                </button>
                <button
                  onClick={() => setFeedbackType('toast')}
                  className={`rounded-xl px-4 py-3 text-sm font-heading font-bold transition-all ${
                    !isRoast
                      ? 'bg-toast text-white shadow-lg shadow-toast/20'
                      : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <Wine className="inline-block w-4 h-4 mr-2" />
                  TOAST
                </button>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-4 gap-2">
                {['ICP', 'Clarity', 'Ask', 'Energy'].map((chip) => (
                  <div
                    key={chip}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300"
                  >
                    {chip}
                  </div>
                ))}
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="font-heading font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Score the pitch
                </h3>

                {/* Clarity */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Clarity</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.clarity}
                    </span>
                  </div>
                  <Slider
                    value={[scores.clarity]}
                    onValueChange={([value]) => setScores({ ...scores, clarity: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Solution */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">ICP</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.solution}
                    </span>
                  </div>
                  <Slider
                    value={[scores.solution]}
                    onValueChange={([value]) => setScores({ ...scores, solution: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Market */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Ask</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.market}
                    </span>
                  </div>
                  <Slider
                    value={[scores.market]}
                    onValueChange={([value]) => setScores({ ...scores, market: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Presentation */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Energy</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.presentation}
                    </span>
                  </div>
                  <Slider
                    value={[scores.presentation]}
                    onValueChange={([value]) => setScores({ ...scores, presentation: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
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

            <div className="border-t border-white/10 bg-slate-950/95 px-4 py-4 shadow-[0_-18px_40px_rgba(2,6,23,0.75)] sm:px-6">
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
}
