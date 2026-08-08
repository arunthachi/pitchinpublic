'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';

interface Step3PublishProps {
  pitchTitle: string;
  eventName?: string | null;
  onPrimaryAction: () => void;
  onOpenPitch?: () => void;
  onRecordAnother?: () => void;
  primaryActionLabel?: string;
}

export function Step3_Publish({
  pitchTitle,
  eventName = null,
  onPrimaryAction,
  onOpenPitch,
  onRecordAnother,
  primaryActionLabel = 'View your pitch',
}: Step3PublishProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex min-h-[min(70dvh,560px)] flex-col justify-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neon-lime text-slate-950">
        <Check className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="mt-6 text-center" role="status" aria-live="polite">
        <h2 className="font-heading text-3xl font-black text-white">
          {eventName ? `Submitted to ${eventName}` : 'Pitch published'}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-slate-300">
          {eventName
            ? 'Your take is ready for the event team to review.'
            : 'Your pitch is live and ready for feedback.'}
        </p>
        {eventName ? (
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
            Private to the event — its team and participants can see it, and it stays out of the public feed. You can share it to the public feed from your pitch page.
          </p>
        ) : null}
        <p className="mx-auto mt-2 line-clamp-2 max-w-sm text-sm text-slate-500">{pitchTitle}</p>
      </div>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="cta-primary inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black"
        >
          {primaryActionLabel}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>

        {onOpenPitch ? (
          <button
            type="button"
            onClick={onOpenPitch}
            className="btn-glass min-h-12 w-full rounded-2xl px-5 py-3 font-heading font-bold text-white"
          >
            Open pitch
          </button>
        ) : null}

        {onRecordAnother ? (
          <button
            type="button"
            onClick={onRecordAnother}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-slate-300 hover:text-white focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Record another
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
