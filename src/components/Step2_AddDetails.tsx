'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { PracticePrompt } from '@/lib/practice';
import { buildPitchDescription, parsePitchDescription } from '@/lib/pitch-copy';

interface Step2_AddDetailsProps {
  videoDuration: number;
  previewUrl: string;
  onNext: (data: { hook: string; description: string }) => void | Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  practicePrompt?: PracticePrompt | null;
  initialHook?: string;
  initialDescription?: string;
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
}: Step2_AddDetailsProps) {
  const [hook, setHook] = useState(initialHook);
  const [startupName, setStartupName] = useState('');
  const [feedbackAsk, setFeedbackAsk] = useState('');
  const [context, setContext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const parsed = parsePitchDescription(initialDescription);
    setHook(initialHook);
    setStartupName(parsed.startupName);
    setFeedbackAsk(parsed.feedbackAsk);
    setContext(parsed.context);
  }, [initialHook, initialDescription]);

  // Check if form is valid
  const isValid =
    startupName.trim().length >= 2 &&
    hook.trim().length >= 10 &&
    hook.trim().length <= 280 &&
    feedbackAsk.trim().length >= 4;

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

    if (!feedbackAsk.trim()) {
      newErrors.feedbackAsk = 'Feedback ask is required';
    } else if (feedbackAsk.trim().length < 4) {
      newErrors.feedbackAsk = 'Feedback ask must be specific enough to guide builders';
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
      await onNext({
        hook: hook.trim(),
        description: buildPitchDescription({
          startupName,
          oneLinePitch: hook,
          feedbackAsk,
          context,
        }),
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
        <h2 className="text-2xl font-bold text-white mb-1">Add pitch details</h2>
        <p className="text-slate-400 text-sm">Give builders enough context to leave useful feedback.</p>
      </div>

      {practicePrompt && (
        <div className="rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Today&apos;s rep</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white">{practicePrompt.prompt}</p>
        </div>
      )}

      {/* Video Preview */}
      <div className="relative aspect-[9/16] max-h-[40vh] mx-auto bg-black rounded-xl overflow-hidden mb-4">
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
        {/* Startup Name */}
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
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon-cyan"
            maxLength={120}
          />
          <div className="mt-1 flex justify-between">
            <span className={`text-xs ${errors.startupName ? 'text-red-400' : 'text-slate-400'}`}>
              {errors.startupName || `${startupName.length}/120`}
            </span>
          </div>
        </div>

        {/* Hook/Title Input */}
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
            placeholder="For [customer], we help [painful problem] so they can [outcome]."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent resize-none"
            rows={3}
            maxLength={280}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.hook ? 'text-red-400' : 'text-slate-400'}`}>
              {errors.hook || `${hook.length}/280`}
            </span>
            {!errors.hook && hook.length >= 10 && (
              <span className="text-xs text-green-400">✓ Great!</span>
            )}
          </div>
        </div>

        {/* Feedback Ask */}
        <div>
          <label htmlFor="feedbackAsk" className="block text-sm font-semibold text-white mb-2">
            Feedback ask <span className="text-red-400">*</span>
          </label>
          <textarea
            id="feedbackAsk"
            value={feedbackAsk}
            onChange={(e) => {
              setFeedbackAsk(e.target.value);
              if (errors.feedbackAsk) {
                setErrors({ ...errors, feedbackAsk: '' });
              }
            }}
            placeholder="What should builders help sharpen? Clarity, ICP, problem, confidence, or the ask?"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent resize-none"
            rows={3}
            maxLength={220}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.feedbackAsk ? 'text-red-400' : 'text-slate-400'}`}>
              {errors.feedbackAsk || `${feedbackAsk.length}/220`}
            </span>
          </div>
        </div>

        {/* Context Input */}
        <div>
          <label htmlFor="context" className="block text-sm font-semibold text-white mb-2">
            Extra context <span className="text-slate-400 text-xs">(optional)</span>
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
            placeholder="Stage, target customer, traction, event, or what changed since your last take..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent resize-none"
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
