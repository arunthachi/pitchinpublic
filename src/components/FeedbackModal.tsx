'use client';

import React, { useState } from 'react';
import { QuickFeedbackPanel } from '@/components/QuickFeedbackPanel';
import { Button } from '@/components/ui/button';
import type { FeedbackFormData } from '@/types';

interface FeedbackModalProps {
  pitchId: string;
  onSubmit: (feedback: FeedbackFormData) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
  hideTrigger?: boolean;
  rubric?: Array<{ id: string; label: string; description?: string | null }> | null;
  onStructuredSubmit?: (feedback: { criterionId: string; sentiment: 'strength' | 'improvement'; observation: string; nextStep: string }) => Promise<void> | void;
}

/** Keep assigned reviews and feed feedback on the same structured workflow. */
export function FeedbackModal({
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  triggerLabel = 'Leave Feedback',
  hideTrigger = false,
  rubric = null,
  onStructuredSubmit,
}: FeedbackModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback((next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);
  const [criterionId, setCriterionId] = useState(rubric?.[0]?.id || '');
  const [sentiment, setSentiment] = useState<'strength' | 'improvement'>('improvement');
  const [observation, setObservation] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = React.useRef<HTMLElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!criterionId && rubric?.[0]?.id) setCriterionId(rubric[0].id);
  }, [criterionId, rubric]);

  React.useEffect(() => {
    if (!open || !rubric?.length) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, textarea, input:not([disabled])')];
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKeyDown); returnFocusRef.current?.focus(); };
  }, [open, rubric, setOpen]);

  const submitStructured = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onStructuredSubmit || !criterionId || !observation.trim() || !nextStep.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onStructuredSubmit({ criterionId, sentiment, observation: observation.trim(), nextStep: nextStep.trim() });
      setObservation('');
      setNextStep('');
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!hideTrigger ? (
        <Button
          type="button"
          size="lg"
          className="font-heading text-base font-bold"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      ) : null}
      {rubric?.length && onStructuredSubmit && open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={() => setOpen(false)}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="structured-feedback-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white shadow-2xl sm:rounded-3xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">Review focus</p><h2 id="structured-feedback-title" className="mt-1 font-heading text-2xl font-black">Help sharpen the next take</h2></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-300 hover:bg-white/10" aria-label="Close feedback form">Close</button></div>
            <form onSubmit={submitStructured} className="mt-5 space-y-5">
              <label className="block text-sm font-bold">Pitch criterion<select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} className="input-dark mt-2 w-full" required>{rubric.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.label}</option>)}</select></label>
              <fieldset><legend className="text-sm font-bold">Type of guidance</legend><div className="mt-2 grid grid-cols-2 gap-2">{(['strength', 'improvement'] as const).map((value) => <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold capitalize ${sentiment === value ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan' : 'border-white/10 text-slate-300'}`}><input type="radio" name="sentiment" value={value} checked={sentiment === value} onChange={() => setSentiment(value)} className="sr-only" />{value}</label>)}</div></fieldset>
              <label className="block text-sm font-bold">What I noticed<textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={4} maxLength={800} className="input-dark mt-2 w-full resize-y" placeholder="Describe a specific moment or pattern in this take." required /><span className="mt-1 block text-right text-xs text-slate-500">{observation.length}/800</span></label>
              <label className="block text-sm font-bold">Try this next<textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} rows={3} maxLength={500} className="input-dark mt-2 w-full resize-y" placeholder="Give one concrete change they can practice in the next take." required /><span className="mt-1 block text-right text-xs text-slate-500">{nextStep.length}/500</span></label>
              {error ? <p role="alert" className="text-sm font-semibold text-roast">{error}</p> : null}
              <button type="submit" disabled={saving || !criterionId || !observation.trim() || !nextStep.trim()} className="cta-primary min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-50">{saving ? 'Saving…' : 'Share actionable guidance'}</button>
            </form>
          </section>
        </div>
      ) : (
        <QuickFeedbackPanel
          isOpen={open}
          onClose={() => setOpen(false)}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}
