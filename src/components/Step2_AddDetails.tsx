'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Target } from 'lucide-react';
import type { PracticePrompt } from '@/lib/practice';
import { formatPitchLength } from '@/lib/duration';
import { buildPitchDescription, parsePitchDescription } from '@/lib/pitch-copy';

interface Step2_AddDetailsProps {
  videoDuration: number;
  previewUrl: string;
  onNext: (data: {
    hook: string;
    description: string;
    startupName: string;
    oneLinePitch: string;
    feedbackAsk: string;
    extraContext: string;
  }) => void | Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  practicePrompt?: PracticePrompt | null;
  initialHook?: string;
  initialDescription?: string;
  initialStartupName?: string;
  initialFeedbackAsk?: string;
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

  const chipMatch = trimmed.match(/^Focus:\s*([^.\n]+)(?:\.\s*)?(.*)$/i);
  if (!chipMatch) return { selected: [] as string[], note: trimmed };

  const selected = chipMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter((item) => feedbackFocusOptions.includes(item));
  const note = (chipMatch[2] || '').replace(/^Note:\s*/i, '').trim();

  return { selected, note };
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

  return {
    selected: inferFeedbackFocus(value),
    note: parsed.note,
  };
}

function buildFeedbackAsk(selected: string[], note: string) {
  const focus = selected.length ? `Focus: ${selected.join(', ')}` : '';
  const cleanNote = note.trim();
  if (focus && cleanNote) return `${focus}. Note: ${cleanNote}`;
  return focus || cleanNote;
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
  submissionContext = null,
}: Step2_AddDetailsProps) {
  const [hook, setHook] = useState(initialHook);
  const [startupName, setStartupName] = useState('');
  const [feedbackFocus, setFeedbackFocus] = useState<string[]>([]);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [context, setContext] = useState('');
  const [isEditingStartup, setIsEditingStartup] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const parsed = parsePitchDescription(initialDescription);
    const parsedAsk = getInitialFeedbackAsk(initialFeedbackAsk || parsed.feedbackAsk);
    setHook(initialHook);
    setStartupName(initialStartupName || parsed.startupName);
    setFeedbackFocus(parsedAsk.selected);
    setFeedbackNote(parsedAsk.note);
    setContext('');
    setIsEditingStartup(!(initialStartupName || parsed.startupName) || !initialHook);
  }, [initialHook, initialDescription, initialStartupName, initialFeedbackAsk]);

  const feedbackAsk = buildFeedbackAsk(feedbackFocus, feedbackNote);
  const hasSavedStartup = startupName.trim().length >= 2 && hook.trim().length >= 10 && !isEditingStartup;
  const formatFocus = (value?: string | null) => {
    if (!value) return 'Unspecified';
    return value
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };
  const formatDeadline = (value?: string | null) => {
    if (!value) return 'No deadline set';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return 'No deadline set';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Check if form is valid
  const isValid =
    startupName.trim().length >= 2 &&
    hook.trim().length >= 10 &&
    hook.trim().length <= 280 &&
    feedbackFocus.length > 0 &&
    feedbackAsk.trim().length >= 4 &&
    feedbackAsk.trim().length <= 220;

  const toggleFeedbackFocus = (option: string) => {
    setErrors((current) => ({ ...current, feedbackAsk: '' }));
    setFeedbackFocus((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option);
      }
      if (current.length >= MAX_SELECTED_FOCUS) {
        return current;
      }
      return [...current, option];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};

    if (!startupName.trim()) {
      newErrors.startupName = 'Startup name is required';
    } else if (startupName.trim().length < 2) {
      newErrors.startupName = 'Startup name must be at least 2 characters';
    } else if (startupName.trim().length > 120) {
      newErrors.startupName = 'Startup name must be at most 120 characters';
    }

    if (!hook.trim()) {
      newErrors.hook = 'One-line pitch is required';
    } else if (hook.trim().length < 10) {
      newErrors.hook = 'One-line pitch must be at least 10 characters';
    } else if (hook.trim().length > 280) {
      newErrors.hook = 'One-line pitch must be at most 280 characters';
    }

    if (!feedbackFocus.length) {
      newErrors.feedbackAsk = 'Pick 1-3 feedback focus areas';
    } else if (feedbackAsk.trim().length < 4) {
      newErrors.feedbackAsk = 'Feedback focus must be specific enough to guide builders';
    } else if (feedbackAsk.trim().length > 220) {
      newErrors.feedbackAsk = 'Feedback ask must be at most 220 characters';
    }

    if (context.length > 800) {
      newErrors.context = 'Context must be at most 800 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanFeedbackAsk = feedbackAsk.trim();

      await onNext({
        hook: hook.trim(),
        description: buildPitchDescription({
          startupName,
          oneLinePitch: hook,
          feedbackAsk: cleanFeedbackAsk,
          context,
        }),
        startupName: startupName.trim(),
        oneLinePitch: hook.trim(),
        feedbackAsk: cleanFeedbackAsk,
        extraContext: context.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Confirm this take</h2>
        <p className="text-slate-400 text-sm">Startup details stay saved. Pick what feedback you want on this version.</p>
      </div>

      {submissionContext && (
        <div className="rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Event submission</p>
          <p className="mt-2 text-sm font-semibold text-white">{submissionContext.name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {formatPitchLength(submissionContext.pitchLengthSeconds || 60)} max · {formatDeadline(submissionContext.deadline)} · Goal {formatFocus(submissionContext.focus)}
          </p>
        </div>
      )}

      {practicePrompt && (
        <div className="rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Today&apos;s rep</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white">{practicePrompt.prompt}</p>
        </div>
      )}

      {/* Video Preview */}
      <div className="relative aspect-[9/16] max-h-[34vh] mx-auto mb-4 overflow-hidden rounded-xl bg-black">
        <video
          src={previewUrl}
          controls
          className="w-full h-full object-contain"
        />
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded-full">
          <span className="text-xs text-white font-medium">{videoDuration}s</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Startup profile</p>
                <p className="text-sm text-slate-500">Saved for your next take</p>
              </div>
            </div>
            {hasSavedStartup && (
              <button
                type="button"
                onClick={() => setIsEditingStartup(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>

          {hasSavedStartup ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-neon-lime" />
                <div className="min-w-0">
                  <p className="truncate font-heading text-lg font-black text-white">{startupName}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-300">{hook}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="startupName" className="block text-sm font-semibold text-white mb-2">
                  Startup name <span className="text-red-400">*</span>
                </label>
                <input
                  id="startupName"
                  value={startupName}
                  onChange={(e) => {
                    setStartupName(e.target.value);
                    if (errors.startupName) {
                      setErrors({ ...errors, startupName: '' });
                    }
                  }}
                  placeholder="Your startup or working title"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                  maxLength={120}
                />
                <div className="mt-1 flex justify-between">
                  <span className={`text-xs ${errors.startupName ? 'text-red-400' : 'text-slate-500'}`}>
                    {errors.startupName || `${startupName.length}/120`}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="hook" className="block text-sm font-semibold text-white mb-2">
                  One-line pitch <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="hook"
                  value={hook}
                  onChange={(e) => {
                    setHook(e.target.value);
                    if (errors.hook) {
                      setErrors({ ...errors, hook: '' });
                    }
                  }}
                  placeholder="Write the version you want founders to react to."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                  rows={3}
                  maxLength={280}
                />
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Template: For [customer], we help [painful problem] so they can [outcome].
                </p>
                <div className="flex justify-between mt-1">
                  <span className={`text-xs ${errors.hook ? 'text-red-400' : 'text-slate-500'}`}>
                    {errors.hook || `${hook.length}/280`}
                  </span>
                  {!errors.hook && hook.length >= 10 && (
                    <span className="text-xs text-green-400">✓ Saved for next time</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neon-lime/15 text-neon-lime">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <label className="text-sm font-semibold text-white">
                Feedback focus <span className="text-red-400">*</span>
              </label>
              <p className="text-xs text-slate-500">Pick up to {MAX_SELECTED_FOCUS}. Builders will respond faster.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {feedbackFocusOptions.map((option) => {
              const selected = feedbackFocus.includes(option);
              const disabled = !selected && feedbackFocus.length >= MAX_SELECTED_FOCUS;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleFeedbackFocus(option)}
                  disabled={disabled}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${
                    selected
                      ? 'border-neon-lime bg-neon-lime/18 text-white shadow-[0_0_24px_rgba(161,255,32,0.16)]'
                      : 'border-white/10 bg-slate-900/50 text-slate-300 hover:border-neon-cyan/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    {option}
                    {selected && <Check className="h-4 w-4 text-neon-lime" />}
                  </span>
                </button>
              );
            })}
          </div>

          <textarea
            id="feedbackNote"
            value={feedbackNote}
            onChange={(e) => {
              setFeedbackNote(e.target.value);
              if (errors.feedbackAsk) {
                setErrors({ ...errors, feedbackAsk: '' });
              }
            }}
            placeholder="Optional: anything specific? Example: Does the first 10 seconds make the buyer obvious?"
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon-cyan"
            rows={3}
            maxLength={160}
          />
          <div className="mt-1 flex justify-between">
            <span className={`text-xs ${errors.feedbackAsk ? 'text-red-400' : 'text-slate-500'}`}>
              {errors.feedbackAsk || `${feedbackAsk.length}/220`}
            </span>
          </div>
        </section>

        {/* Context Input */}
        <div>
          <label htmlFor="context" className="block text-sm font-semibold text-white mb-2">
            What changed in this take? <span className="text-slate-400 text-xs">(optional)</span>
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              if (errors.context) {
                setErrors({ ...errors, context: '' });
              }
            }}
            placeholder="New opening, sharper ICP, event version, traction update, or what you want compared to the last take..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon-cyan"
            rows={3}
            maxLength={800}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.context ? 'text-red-400' : 'text-slate-400'}`}>
              {errors.context || `${context.length}/800`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting || isLoading}
            className="flex-1 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting || isLoading}
            className="flex-1 py-3 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                Publish pitch
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
