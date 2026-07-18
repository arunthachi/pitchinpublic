'use client';

import { useState } from 'react';
import { Check, CircleAlert, MessageCircleMore, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { FeedbackQualityAction, FeedbackQualityRating } from '@/types';

const OPTIONS = [
  { value: 'useful' as const, label: 'Useful', icon: ThumbsUp },
  { value: 'generic' as const, label: 'Generic', icon: MessageCircleMore },
  { value: 'not_helpful' as const, label: 'Not helpful', icon: ThumbsDown },
];

export function FeedbackQualityControls({
  action,
  initialRating,
}: {
  action: FeedbackQualityAction;
  initialRating?: FeedbackQualityRating | null;
}) {
  const [rating, setRating] = useState<FeedbackQualityRating | null>(initialRating || null);
  const [pending, setPending] = useState<FeedbackQualityRating | null>(null);
  const [error, setError] = useState('');

  const submit = async (nextRating: FeedbackQualityRating) => {
    if (pending) return;
    const previous = rating;
    setRating(nextRating);
    setPending(nextRating);
    setError('');
    try {
      const response = await fetch(action.href, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: nextRating }),
      });
      if (!response.ok) throw new Error('Could not save this rating. Try again.');
    } catch (caught) {
      setRating(previous);
      setError(caught instanceof Error ? caught.message : 'Could not save this rating. Try again.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-[11px] font-bold text-slate-500">Was this feedback useful?</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Rate feedback quality">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = rating === value;
          return (
            <button
              key={value}
              type="button"
              disabled={Boolean(pending)}
              onClick={() => submit(value)}
              aria-pressed={selected}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${
                selected
                  ? 'border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {selected && !pending ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {pending === value ? 'Saving...' : label}
            </button>
          );
        })}
      </div>
      <p className={`mt-2 flex min-h-4 items-center gap-1 text-[11px] ${error ? 'text-roast' : 'text-slate-500'}`} role="status" aria-live="polite">
        {error ? <><CircleAlert className="h-3 w-3" />{error}</> : rating && !pending ? 'Saved privately.' : ''}
      </p>
    </div>
  );
}
