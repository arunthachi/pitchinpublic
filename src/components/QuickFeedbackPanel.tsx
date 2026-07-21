'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Flame, MessageSquarePlus, Target, Wine, X } from 'lucide-react';
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

type SheetLayout = {
  mode: 'phone' | 'sidecar' | 'dialog';
  keyboardOpen: boolean;
  style: React.CSSProperties;
};

const toastSignals = ['Clear', 'Compelling', 'Strong problem', 'Strong ask'];
const roastSignals = ['Unclear audience', 'Weak pain', 'Too much jargon', 'Missing ask', 'Not urgent'];
const maxSignals = 3;
const readinessLevels = [
  { value: 1, label: 'Needs work', helper: 'The core message is not landing yet.' },
  { value: 2, label: 'Getting there', helper: 'The direction is visible, but it needs focus.' },
  { value: 3, label: 'Strong', helper: 'Clear and useful for the right room.' },
  { value: 4, label: 'Pitch-ready', helper: 'Ready to hold attention under pressure.' },
];

function useFeedbackSheetLayout(isOpen: boolean): SheetLayout {
  const [layout, setLayout] = React.useState<SheetLayout>({
    mode: 'phone',
    keyboardOpen: false,
    style: {},
  });

  React.useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const keyboardOpen = window.innerHeight - viewportHeight > 150;
      const frame = document.querySelector<HTMLElement>('[data-feed-frame="true"]');
      const frameRect = frame?.getBoundingClientRect();
      const hasFrame = Boolean(frameRect && frameRect.width > 0 && frameRect.height > 0);

      if (keyboardOpen) {
        setLayout({
          mode: 'phone',
          keyboardOpen: true,
          style: {
            left: Math.max(viewportLeft + 8, hasFrame ? frameRect!.left + 8 : viewportLeft + 8),
            top: viewportTop + 8,
            width: Math.max(
              280,
              Math.min(
                viewportWidth - 16,
                hasFrame ? frameRect!.width - 16 : viewportWidth - 16
              )
            ),
            height: Math.max(280, viewportHeight - 16),
            maxHeight: Math.max(280, viewportHeight - 16),
          },
        });
        return;
      }

      if (window.innerWidth < 1024) {
        const sourceLeft = hasFrame ? Math.max(viewportLeft, frameRect!.left) : viewportLeft;
        const sourceRight = hasFrame ? Math.min(viewportRight, frameRect!.right) : viewportRight;
        const sourceTop = hasFrame ? Math.max(viewportTop, frameRect!.top) : viewportTop;
        const sourceBottom = hasFrame ? Math.min(viewportBottom, frameRect!.bottom) : viewportBottom;
        const sourceHeight = Math.max(1, sourceBottom - sourceTop);
        const top = sourceTop + Math.round(sourceHeight * 0.3);

        setLayout({
          mode: 'phone',
          keyboardOpen: false,
          style: {
            left: sourceLeft + 8,
            top,
            width: Math.max(280, sourceRight - sourceLeft - 16),
            height: sourceBottom - top,
            maxHeight: sourceBottom - top,
          },
        });
        return;
      }

      if (hasFrame) {
        const gap = 76;
        const rightSpace = viewportRight - frameRect!.right - gap - 16;
        const leftSpace = frameRect!.left - viewportLeft - gap - 16;
        const side = rightSpace >= 340 ? 'right' : leftSpace >= 340 ? 'left' : null;

        const availableHeight = Math.min(viewportBottom - 16, frameRect!.bottom)
          - Math.max(viewportTop + 16, frameRect!.top);

        if (side && availableHeight >= 420) {
          const width = Math.min(420, side === 'right' ? rightSpace : leftSpace);
          const top = Math.max(viewportTop + 16, frameRect!.top);
          const bottom = Math.min(viewportBottom - 16, frameRect!.bottom);
          setLayout({
            mode: 'sidecar',
            keyboardOpen: false,
            style: {
              left: side === 'right' ? frameRect!.right + gap : frameRect!.left - gap - width,
              top,
              width,
              height: bottom - top,
              maxHeight: bottom - top,
            },
          });
          return;
        }
      }

      const width = Math.min(440, viewportWidth - 32);
      const height = Math.min(760, viewportHeight - 32);
      setLayout({
        mode: 'dialog',
        keyboardOpen: false,
        style: {
          left: viewportLeft + (viewportWidth - width) / 2,
          top: viewportTop + (viewportHeight - height) / 2,
          width,
          height,
          maxHeight: height,
        },
      });
    };

    update();
    const viewport = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
  }, [isOpen]);

  return layout;
}

function readinessToScores(readiness: number) {
  const score = readiness * 2.5;
  return { clarity: score, solution: score, market: score, presentation: score };
}

function getFocusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hasAttribute('hidden'));
}

export function QuickFeedbackPanel({ isOpen, onClose, onSubmit, initialType = 'toast' }: QuickFeedbackPanelProps) {
  const [portalNode, setPortalNode] = React.useState<HTMLElement | null>(null);
  const layout = useFeedbackSheetLayout(isOpen);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>(initialType);
  const [signals, setSignals] = useState<string[]>([toastSignals[0]]);
  const [readiness, setReadiness] = useState(2);
  const [noteOpen, setNoteOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isRoast = feedbackType === 'roast';
  const activeSignals = isRoast ? roastSignals : toastSignals;
  const selectedReadiness = readinessLevels.find((level) => level.value === readiness)!;

  React.useEffect(() => {
    setPortalNode(document.body);
  }, []);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    setFeedbackType(initialType);
    setSignals([initialType === 'roast' ? roastSignals[0] : toastSignals[0]]);
    setSubmitError('');
  }, [initialType, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = getFocusableElements(panelRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      previousFocus?.focus();
    };
  }, [isOpen]);

  const handleSubmit = async () => {
    const selectedSignals = signals.length ? signals : [activeSignals[0]];
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await onSubmit({
        type: feedbackType,
        signal: selectedSignals[0],
        signals: selectedSignals,
        readiness,
        scores: readinessToScores(readiness),
        notes: notes.trim(),
      });
      if (result === false) {
        setSubmitError('Could not save feedback. Please try again.');
        return;
      }

      onClose();
      setReadiness(2);
      setNoteOpen(false);
      setNotes('');
      setSignals([activeSignals[0]]);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not save feedback. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const chooseType = (type: 'roast' | 'toast') => {
    setFeedbackType(type);
    setSignals([type === 'roast' ? roastSignals[0] : toastSignals[0]]);
  };

  const toggleSignal = (option: string) => {
    setSignals((current) => {
      if (current.includes(option)) {
        return current.length === 1 ? current : current.filter((item) => item !== option);
      }
      return current.length >= maxSignals ? [...current.slice(1), option] : [...current, option];
    });
  };

  const openNote = () => {
    setNoteOpen(true);
    window.requestAnimationFrame(() => {
      noteRef.current?.focus();
      noteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const stopPanelEvent = (event: React.SyntheticEvent) => event.stopPropagation();
  const roundedClass = layout.mode === 'phone' && !layout.keyboardOpen
    ? 'rounded-t-[1.5rem] rounded-b-none sm:rounded-[1.5rem]'
    : 'rounded-[1.5rem]';

  const panel = (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] h-full w-full cursor-default bg-black/48 backdrop-blur-sm"
            style={{ touchAction: 'none' }}
            aria-label="Close feedback panel"
          />

          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: layout.mode === 'phone' ? 48 : 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: layout.mode === 'phone' ? 36 : 12, scale: 0.985 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onPointerDown={stopPanelEvent}
            onWheel={stopPanelEvent}
            onTouchMove={stopPanelEvent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-feedback-title"
            aria-describedby="quick-feedback-context"
            data-feedback-panel="quick"
            data-feedback-layout={layout.mode}
            className={`glass-panel fixed z-[90] flex min-h-0 flex-col overflow-hidden border-white/15 ring-1 ring-white/10 ${roundedClass}`}
            style={{ ...layout.style, touchAction: 'pan-y' }}
          >
            <div className="flex shrink-0 flex-col border-b border-white/10 bg-black/20 px-4 pb-3 pt-2 sm:px-5">
              {layout.mode === 'phone' && !layout.keyboardOpen ? (
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p id="quick-feedback-context" className="text-[10px] font-black uppercase tracking-[0.16em] text-neon-cyan">
                    Builder feedback
                  </p>
                  <h2 id="quick-feedback-title" className="mt-0.5 truncate font-heading text-lg font-black text-white sm:text-xl">
                    Help sharpen this pitch
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="btn-glass flex h-10 w-10 shrink-0 items-center justify-center focus:outline-none focus:ring-2 focus:ring-neon-cyan/70"
                  aria-label="Close feedback panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              data-feedback-panel-body="quick"
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="grid min-h-11 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1" role="group" aria-label="Feedback type">
                <button
                  type="button"
                  onClick={() => chooseType('roast')}
                  aria-pressed={isRoast}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition-colors focus:outline-none focus:ring-2 focus:ring-roast/70 ${
                    isRoast ? 'bg-roast text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <Flame className="h-4 w-4" />
                  Roast
                </button>
                <button
                  type="button"
                  onClick={() => chooseType('toast')}
                  aria-pressed={!isRoast}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition-colors focus:outline-none focus:ring-2 focus:ring-toast/70 ${
                    !isRoast ? 'bg-toast text-slate-950' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <Wine className="h-4 w-4" />
                  Toast
                </button>
              </div>

              <section className="space-y-2" aria-labelledby="feedback-signals-title">
                <div className="flex items-center gap-2 px-0.5">
                  <Target className={`h-3.5 w-3.5 ${isRoast ? 'text-roast' : 'text-toast'}`} />
                  <h3 id="feedback-signals-title" className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">
                    Signals
                  </h3>
                  <span className="ml-auto text-xs font-bold text-slate-500">{signals.length}/{maxSignals}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSignals.map((option) => {
                    const selected = signals.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleSignal(option)}
                        aria-pressed={selected}
                        className={`inline-flex min-h-11 flex-[1_1_calc(50%-0.5rem)] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors focus:outline-none focus:ring-2 ${
                          selected
                            ? isRoast
                              ? 'border-roast/70 bg-roast/15 text-white focus:ring-roast/60'
                              : 'border-toast/70 bg-toast/15 text-white focus:ring-toast/60'
                            : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/[0.08] focus:ring-neon-cyan/60'
                        }`}
                      >
                        <span>{option}</span>
                        {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2" aria-labelledby="feedback-readiness-title">
                <h3 id="feedback-readiness-title" className="px-0.5 text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">
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
                        aria-pressed={selected}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-neon-cyan/60 ${
                          selected
                            ? 'border-neon-cyan/70 bg-neon-cyan/15 text-white'
                            : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/[0.08]'
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
                <p className="px-1 text-xs leading-5 text-slate-400" aria-live="polite">
                  {selectedReadiness.helper}
                </p>
              </section>

              {noteOpen ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="quick-feedback-note" className="text-sm font-bold text-slate-300">Optional note</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNoteOpen(false);
                        setNotes('');
                      }}
                      className="min-h-9 rounded-lg px-2 text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                  <Textarea
                    ref={noteRef}
                    id="quick-feedback-note"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    onFocus={() => window.setTimeout(() => noteRef.current?.scrollIntoView({ block: 'center' }), 120)}
                    onPointerDown={stopPanelEvent}
                    placeholder={isRoast ? 'What is unclear or missing?' : 'What is working well?'}
                    rows={3}
                    className="min-h-[96px] resize-none text-base"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openNote}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.035] px-3 text-sm font-bold text-slate-300 transition-colors hover:border-neon-cyan/35 hover:bg-white/[0.07] hover:text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/60"
                >
                  <MessageSquarePlus className="h-4 w-4 text-neon-cyan" />
                  Add an optional note
                </button>
              )}
            </div>

            <div
              className="shrink-0 border-t border-white/10 bg-black/35 px-4 pt-3 shadow-[0_-16px_36px_rgba(2,6,23,0.5)] sm:px-5"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
            >
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`min-h-12 w-full rounded-full text-sm font-heading font-black sm:text-base ${
                  isRoast ? 'bg-roast text-white hover:bg-roast/90' : 'bg-toast text-slate-950 hover:bg-toast/90'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSubmitting ? 'Saving feedback...' : isRoast ? 'Submit constructive roast' : 'Submit useful toast'}
              </Button>
              {submitError ? (
                <p className="mt-2 text-center text-sm font-semibold text-roast" role="alert">
                  {submitError}
                </p>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return portalNode ? createPortal(panel, portalNode) : null;
}
