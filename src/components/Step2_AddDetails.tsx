'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import type { PracticePrompt } from '@/lib/practice';
import { buildPitchDescription, parsePitchDescription } from '@/lib/pitch-copy';

export interface PitchDetailsData {
  hook: string;
  description: string;
  startupName: string;
  oneLinePitch: string;
  feedbackAsk: string;
  extraContext: string;
}

interface Step2AddDetailsProps {
  videoDuration: number;
  previewUrl: string;
  onNext: (data: PitchDetailsData) => void | Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  practicePrompt?: PracticePrompt | null;
  initialHook?: string;
  initialDescription?: string;
  initialStartupName?: string;
  initialFeedbackAsk?: string;
  submissionError?: string;
  retryingSubmission?: boolean;
  submissionContext?: {
    slug: string;
    name: string;
    deadline?: string | null;
    pitchLengthSeconds?: number | null;
    focus?: string | null;
  } | null;
}

const feedbackFocusOptions = [
  'Clarity',
  'ICP',
  'Problem',
  'Differentiation',
  'Story',
  'Confidence',
  'Closing ask',
  'Want to learn more?',
];

const MAX_SELECTED_FOCUS = 3;

function parseFeedbackAsk(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { selected: [] as string[], note: '' };
  const chipMatch = trimmed.match(/^Focus:\s*([^\.\n]+)(?:\.\s*)?(.*)$/i);
  if (!chipMatch) return { selected: [] as string[], note: trimmed };

  return {
    selected: chipMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter((item) => feedbackFocusOptions.includes(item))
      .slice(0, MAX_SELECTED_FOCUS),
    note: (chipMatch[2] || '').replace(/^Note:\s*/i, '').trim(),
  };
}

function inferFeedbackFocus(value: string) {
  const lower = value.toLowerCase();
  return feedbackFocusOptions.filter((option) => {
    if (option === 'ICP') return /\bicp\b|customer|audience|buyer/.test(lower);
    if (option === 'Closing ask') return /\bask\b|close|closing|cta|call to action/.test(lower);
    if (option === 'Want to learn more?') return /learn more|interest|curious|compelling/.test(lower);
    return lower.includes(option.toLowerCase());
  }).slice(0, MAX_SELECTED_FOCUS);
}

function getInitialFeedbackAsk(value: string) {
  const parsed = parseFeedbackAsk(value);
  if (parsed.selected.length) return parsed;
  return { selected: inferFeedbackFocus(value), note: parsed.note };
}

function buildFeedbackAsk(selected: string[], note: string) {
  const focus = selected.length ? `Focus: ${selected.join(', ')}` : '';
  const cleanNote = note.trim();
  if (focus && cleanNote) return `${focus}. Note: ${cleanNote}`;
  return focus || cleanNote;
}

export function validatePitchDetails(values: {
  hook: string;
  startupName: string;
  feedbackAsk: string;
  context: string;
}) {
  const errors: Record<string, string> = {};
  const hook = values.hook.trim();
  const startupName = values.startupName.trim();
  const feedbackAsk = values.feedbackAsk.trim();

  if (!hook) errors.hook = 'Add a one-line pitch to submit this take.';
  else if (hook.length < 10) errors.hook = 'Use at least 10 characters.';
  else if (hook.length > 280) errors.hook = 'Keep the one-line pitch under 280 characters.';

  if (startupName && startupName.length < 2) errors.startupName = 'Use at least 2 characters or leave this blank.';
  else if (startupName.length > 120) errors.startupName = 'Keep the startup name under 120 characters.';

  if (feedbackAsk && feedbackAsk.length < 4) errors.feedbackAsk = 'Use at least 4 characters or leave this blank.';
  else if (feedbackAsk.length > 220) errors.feedbackAsk = 'Keep feedback details under 220 characters.';

  if (values.context.length > 800) errors.context = 'Keep context under 800 characters.';
  return errors;
}

export function Step2_AddDetails({
  videoDuration,
  previewUrl,
  onNext,
  onBack,
  isLoading = false,
  practicePrompt,
  initialHook = '',
  initialDescription = '',
  initialStartupName = '',
  initialFeedbackAsk = '',
  submissionError = '',
  retryingSubmission = false,
  submissionContext = null,
}: Step2AddDetailsProps) {
  const [hook, setHook] = useState(initialHook);
  const [startupName, setStartupName] = useState('');
  const [feedbackFocus, setFeedbackFocus] = useState<string[]>([]);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [context, setContext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const parsed = parsePitchDescription(initialDescription);
    const feedbackDefault = initialFeedbackAsk || parsed.feedbackAsk || submissionContext?.focus || '';
    const parsedAsk = getInitialFeedbackAsk(feedbackDefault);
    setHook(initialHook);
    setStartupName(initialStartupName || parsed.startupName);
    setFeedbackFocus(parsedAsk.selected);
    setFeedbackNote(parsedAsk.note);
    setContext(parsed.context || '');
    setErrors({});
  }, [initialHook, initialDescription, initialStartupName, initialFeedbackAsk, submissionContext?.focus]);

  const feedbackAsk = buildFeedbackAsk(feedbackFocus, feedbackNote);
  const hasReadyHook = hook.trim().length >= 10 && hook.trim().length <= 280;

  const toggleFeedbackFocus = (option: string) => {
    setErrors((current) => ({ ...current, feedbackAsk: '' }));
    setFeedbackFocus((current) => {
      if (current.includes(option)) return current.filter((item) => item !== option);
      if (current.length >= MAX_SELECTED_FOCUS) return current;
      return [...current, option];
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validatePitchDetails({ hook, startupName, feedbackAsk, context });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const cleanStartupName = startupName.trim();
    const cleanFeedbackAsk = feedbackAsk.trim();
    const cleanContext = context.trim();
    const description = cleanStartupName || cleanFeedbackAsk || cleanContext
      ? buildPitchDescription({
          startupName: cleanStartupName,
          oneLinePitch: hook,
          feedbackAsk: cleanFeedbackAsk,
          context: cleanContext,
        })
      : '';

    setIsSubmitting(true);
    try {
      await onNext({
        hook: hook.trim(),
        description,
        startupName: cleanStartupName,
        oneLinePitch: hook.trim(),
        feedbackAsk: cleanFeedbackAsk,
        extraContext: cleanContext,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = retryingSubmission
    ? 'Retry submission'
    : submissionContext
      ? `Submit to ${submissionContext.name}`
      : 'Publish pitch';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      <header className="pr-12">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">
          {submissionContext ? submissionContext.name : practicePrompt ? "Today's rep" : 'New pitch'}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-black text-white">Review your take</h2>
        {practicePrompt ? <p className="mt-1 text-sm text-slate-400">{practicePrompt.prompt}</p> : null}
      </header>

      <div className="relative mx-auto aspect-[9/16] max-h-[30dvh] overflow-hidden rounded-2xl bg-black">
        <video src={previewUrl} controls playsInline className="h-full w-full object-contain" />
        <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white">
          {videoDuration}s
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {hasReadyHook ? (
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">One-line pitch</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-white">{hook}</p>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="hook" className="mb-2 block text-sm font-bold text-white">
              One-line pitch
            </label>
            <textarea
              id="hook"
              value={hook}
              onChange={(event) => {
                setHook(event.target.value);
                setErrors((current) => ({ ...current, hook: '' }));
              }}
              aria-invalid={Boolean(errors.hook)}
              aria-describedby={errors.hook ? 'hook-error' : undefined}
              placeholder="What does your startup do?"
              rows={2}
              maxLength={280}
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon-cyan"
            />
            {errors.hook ? <p id="hook-error" className="mt-2 text-sm text-red-300">{errors.hook}</p> : null}
          </div>
        )}

        <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-slate-200 focus-visible:ring-2 focus-visible:ring-neon-cyan">
            Add details <span className="text-xs font-semibold text-slate-500">Optional</span>
          </summary>
          <div className="space-y-4 border-t border-white/10 p-4">
            {hasReadyHook ? (
              <div>
                <label htmlFor="hook-optional" className="mb-2 block text-sm font-bold text-white">One-line pitch</label>
                <textarea
                  id="hook-optional"
                  value={hook}
                  onChange={(event) => setHook(event.target.value)}
                  rows={2}
                  maxLength={280}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                />
                {errors.hook ? <p className="mt-2 text-sm text-red-300">{errors.hook}</p> : null}
              </div>
            ) : null}

            <div>
              <label htmlFor="startupName" className="mb-2 block text-sm font-bold text-white">Startup name</label>
              <input
                id="startupName"
                value={startupName}
                onChange={(event) => {
                  setStartupName(event.target.value);
                  setErrors((current) => ({ ...current, startupName: '' }));
                }}
                placeholder="Optional"
                maxLength={120}
                className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan"
              />
              {errors.startupName ? <p className="mt-2 text-sm text-red-300">{errors.startupName}</p> : null}
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-white">Feedback focus</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {feedbackFocusOptions.map((option) => {
                  const selected = feedbackFocus.includes(option);
                  const disabled = !selected && feedbackFocus.length >= MAX_SELECTED_FOCUS;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleFeedbackFocus(option)}
                      disabled={disabled}
                      aria-pressed={selected}
                      className={`min-h-11 rounded-full border px-3 py-2 text-sm font-bold ${
                        selected
                          ? 'border-neon-lime bg-neon-lime/15 text-white'
                          : 'border-white/10 text-slate-300 disabled:opacity-40'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={feedbackNote}
                onChange={(event) => setFeedbackNote(event.target.value)}
                placeholder="Anything specific?"
                rows={2}
                maxLength={160}
                className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan"
              />
              {errors.feedbackAsk ? <p className="mt-2 text-sm text-red-300">{errors.feedbackAsk}</p> : null}
            </fieldset>

            <div>
              <label htmlFor="context" className="mb-2 block text-sm font-bold text-white">Context</label>
              <textarea
                id="context"
                value={context}
                onChange={(event) => {
                  setContext(event.target.value);
                  setErrors((current) => ({ ...current, context: '' }));
                }}
                placeholder="What changed in this take?"
                rows={2}
                maxLength={800}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan"
              />
              {errors.context ? <p className="mt-2 text-sm text-red-300">{errors.context}</p> : null}
            </div>
          </div>
        </details>

        {submissionError ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100" role="alert">
            {submissionError}
          </div>
        ) : null}

        <div className="flex gap-3 pt-1">
          {!retryingSubmission ? (
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting || isLoading}
              className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 font-bold text-slate-300 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Retake
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting || isLoading || !hasReadyHook}
            className="cta-primary inline-flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-2xl px-4 py-3 font-heading font-black disabled:opacity-50"
          >
            {isSubmitting || isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{retryingSubmission ? 'Retrying…' : 'Submitting…'}</>
            ) : submitLabel}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
