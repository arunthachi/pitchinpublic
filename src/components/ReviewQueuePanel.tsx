'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ClipboardCheck, Coins, X } from 'lucide-react';
import type { ReviewQueueSummary } from '@/types';
import { pitchPath } from '@/lib/public-routes';

export function ReviewQueuePanel({ queue }: { queue: ReviewQueueSummary | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!queue?.items.length) return null;

  const activeItems = queue.items
    .filter((item) => item.status === 'pending' || item.status === 'started')
    .slice(0, 3);
  if (!activeItems.length) return null;
  const credits = queue.credits;

  const content = (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neon-cyan">Review queue</p>
          <h2 className="mt-1 font-heading text-base font-black text-white">
            {queue.pendingCount} pitch{queue.pendingCount === 1 ? '' : 'es'} waiting for your signal
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="btn-glass flex h-9 w-9 items-center justify-center lg:hidden"
          aria-label="Close review queue"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {activeItems.map((item, index) => (
          <Link
            key={item.id}
            href={pitchPath(item.publicPitchId, item.pitchId) || '/'}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5 transition hover:border-neon-cyan/30 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-neon-cyan/60"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-black text-slate-300">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white">{item.startupName}</span>
              <span className="block truncate text-xs text-slate-400">{item.eventName || item.hook}</span>
            </span>
            {item.status === 'started' ? (
              <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-black uppercase text-amber-300">Started</span>
            ) : null}
          </Link>
        ))}
      </div>

      {credits ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
              <Coins className="h-3.5 w-3.5 text-neon-lime" />
              {credits.exempt ? 'Credits waived' : `${credits.available} credit${credits.available === 1 ? '' : 's'} ready`}
            </span>
            {!credits.exempt ? <span className="text-slate-500">{credits.pending} pending</span> : null}
          </div>
          {!credits.exempt ? (
            <div className="mt-2 flex gap-1" aria-label={`${credits.progress} of ${credits.reviewsPerCredit} useful reviews toward the next credit`}>
              {Array.from({ length: credits.reviewsPerCredit }).map((_, index) => (
                <span key={index} className={`h-1.5 flex-1 rounded-full ${index < credits.progress ? 'bg-neon-lime' : 'bg-white/10'}`} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <aside className="glass-card hidden w-[18rem] overflow-hidden rounded-2xl lg:block" aria-label="Assigned pitch reviews">
        {content}
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="glass-pill fixed bottom-24 left-3 z-[65] flex max-w-[calc(100vw-6.5rem)] items-center gap-2 rounded-full px-3 py-2.5 text-left lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="mobile-review-queue"
      >
        <ClipboardCheck className="h-4 w-4 shrink-0 text-neon-cyan" />
        <span className="truncate text-xs font-black text-white">{queue.pendingCount} waiting</span>
        {credits && !credits.exempt ? <span className="text-[10px] font-bold text-neon-lime">{credits.available} cr</span> : null}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[95] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-review-queue-title">
          <button type="button" onClick={() => setMobileOpen(false)} className="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-sm" aria-label="Close review queue" />
          <div id="mobile-review-queue" className="glass-panel absolute inset-x-3 bottom-20 max-h-[70dvh] overflow-y-auto rounded-2xl">
            <span id="mobile-review-queue-title" className="sr-only">Assigned pitch reviews</span>
            {content}
          </div>
        </div>
      ) : null}
    </>
  );
}
