'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, Flame, MessageSquareText, RotateCcw, Wine } from 'lucide-react';
import type { LegacyFeedback } from '@/types';
import { feedbackReviewerDisplay } from '@/lib/review-marketplace';
import { pitchPath } from '@/lib/public-routes';
import {
  feedbackHistoryRequestUrl,
  givenFeedbackNotes,
  type GivenFeedbackItem,
  type HistoryCursor,
} from './ProfileFeedbackHistory.helpers';

export { feedbackHistoryRequestUrl, givenFeedbackNotes } from './ProfileFeedbackHistory.helpers';

export type FeedbackHistoryView = 'received' | 'given';
export type ReceivedFeedbackState = 'available' | 'unavailable';

type HistoryResponse = {
  success: boolean;
  items?: GivenFeedbackItem[];
  nextCursor?: HistoryCursor | null;
  error?: string;
};

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function FeedbackBadge({ type, label }: { type: 'roast' | 'toast'; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase ${type === 'roast' ? 'bg-roast/15 text-roast' : 'bg-toast/15 text-toast'}`}>
      {type === 'roast' ? <Flame className="h-3.5 w-3.5" /> : <Wine className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function FeedbackEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="col-span-full rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
        <MessageSquareText className="h-7 w-7" />
      </div>
      <h3 className="font-heading text-2xl font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md leading-7 text-slate-400">{body}</p>
    </div>
  );
}

function HistoryError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="col-span-full rounded-3xl border border-red-400/25 bg-red-400/10 p-6 text-center">
      <AlertCircle className="mx-auto h-7 w-7 text-red-300" />
      <p className="mt-3 font-bold text-white">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-bold text-white">
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function ProfileFeedbackHistory({
  received,
  receivedState,
  showGiven,
  activeView,
  onViewChange,
}: {
  received: LegacyFeedback[];
  receivedState: ReceivedFeedbackState;
  showGiven: boolean;
  activeView: FeedbackHistoryView;
  onViewChange: (view: FeedbackHistoryView) => void;
}) {
  const [given, setGiven] = useState<GivenFeedbackItem[]>([]);
  const [nextCursor, setNextCursor] = useState<HistoryCursor | null>(null);
  const [givenStatus, setGivenStatus] = useState<'idle' | 'loading' | 'available' | 'error'>('idle');
  const [givenError, setGivenError] = useState('');

  const loadGiven = useCallback(async (cursor: HistoryCursor | null) => {
    setGivenStatus('loading');
    setGivenError('');

    try {
      const response = await fetch(feedbackHistoryRequestUrl(cursor));
      const payload = await response.json().catch(() => ({})) as HistoryResponse;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || 'Could not load feedback you have given.');
      }

      setGiven((current) => cursor ? [...current, ...(payload.items || [])] : payload.items || []);
      setNextCursor(payload.nextCursor || null);
      setGivenStatus('available');
    } catch (error) {
      setGivenError(error instanceof Error ? error.message : 'Could not load feedback you have given.');
      setGivenStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!showGiven || activeView !== 'given' || givenStatus !== 'idle') return;
    void loadGiven(null);
  }, [activeView, givenStatus, loadGiven, showGiven]);

  const handleViewKeyDown = (event: KeyboardEvent<HTMLButtonElement>, view: FeedbackHistoryView) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextView = event.key === 'ArrowLeft' || event.key === 'Home'
      ? 'received'
      : event.key === 'ArrowRight' || event.key === 'End'
        ? 'given'
        : view;
    onViewChange(nextView);
    document.getElementById(`feedback-${nextView}-tab`)?.focus();
  };

  const selectedView = showGiven ? activeView : 'received';

  return (
    <section className="mt-6" aria-label="Feedback history">
      {showGiven ? (
        <div role="tablist" aria-label="Feedback direction" className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/[0.035] p-1">
          {(['received', 'given'] as const).map((view) => (
            <button
              key={view}
              id={`feedback-${view}-tab`}
              type="button"
              role="tab"
              aria-selected={selectedView === view}
              aria-controls={`feedback-${view}-panel`}
              tabIndex={selectedView === view ? 0 : -1}
              onClick={() => onViewChange(view)}
              onKeyDown={(event) => handleViewKeyDown(event, view)}
              className={`min-h-11 rounded-xl px-5 text-sm font-bold capitalize transition ${selectedView === view ? 'bg-neon-lime text-slate-950' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'}`}
            >
              {view}
            </button>
          ))}
        </div>
      ) : null}

      {selectedView === 'received' ? (
        <div id="feedback-received-panel" role={showGiven ? 'tabpanel' : undefined} aria-labelledby={showGiven ? 'feedback-received-tab' : undefined} className="grid gap-3 md:grid-cols-2">
          {receivedState === 'unavailable' ? (
            <HistoryError message="Feedback is temporarily unavailable. Your notes are still saved. Please try again soon." />
          ) : received.length ? received.map((item) => {
            const reviewer = feedbackReviewerDisplay(item);
            return (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <FeedbackBadge type={item.type} label={(item.signals?.length ? item.signals.join(' + ') : item.signal) || item.type} />
                  <span className="text-xs font-semibold text-slate-500">{item.createdAt ? formatHistoryDate(item.createdAt) : null}</span>
                </div>
                <p className="text-sm leading-6 text-slate-200">{item.notes || 'Signal-only coach note.'}</p>
                <span className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {reviewer.role}
                </span>
                {reviewer.expertise.length ? <p className="mt-1 truncate text-[10px] text-slate-500">{reviewer.expertise.slice(0, 2).join(' · ')}</p> : null}
              </article>
            );
          }) : (
            <FeedbackEmptyState title="No feedback received yet" body="Coach notes will appear here after builders respond to pitches." />
          )}
        </div>
      ) : (
        <div id="feedback-given-panel" role="tabpanel" aria-labelledby="feedback-given-tab" className="grid gap-3 md:grid-cols-2">
          {givenStatus === 'loading' && given.length === 0 ? (
            <div role="status" className="col-span-full rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center text-slate-300">Loading feedback you have given…</div>
          ) : givenStatus === 'error' && given.length === 0 ? (
            <HistoryError message={givenError} onRetry={() => { setGivenStatus('idle'); }} />
          ) : given.length ? (
            <>
              {given.map((item) => {
                const href = item.pitch.available ? pitchPath(item.pitch.publicId, item.pitch.id) : null;
                const title = item.pitch.available ? item.pitch.startupName || item.pitch.hook || 'Pitch' : 'Pitch unavailable';
                return (
                  <article key={item.feedbackId} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <FeedbackBadge type={item.type} label={item.type} />
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{formatHistoryDate(item.createdAt)}</span>
                    </div>
                    {href ? <Link href={href} className="font-heading text-lg font-bold text-white underline decoration-white/20 underline-offset-4 hover:decoration-neon-cyan">{title}</Link> : <p className="font-heading text-lg font-bold text-slate-400">Pitch unavailable</p>}
                    <p className="mt-2 text-sm leading-6 text-slate-200">{givenFeedbackNotes(item)}</p>
                    {item.structured.nextStep ? <p className="mt-3 rounded-xl bg-black/25 p-3 text-xs leading-5 text-slate-400"><span className="font-bold text-slate-300">Next step:</span> {item.structured.nextStep}</p> : null}
                  </article>
                );
              })}
              {nextCursor ? (
                <div className="col-span-full text-center">
                  <button type="button" disabled={givenStatus === 'loading'} onClick={() => void loadGiven(nextCursor)} className="min-h-11 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-bold text-white disabled:opacity-50">
                    {givenStatus === 'loading' ? 'Loading…' : 'Load more'}
                  </button>
                  {givenStatus === 'error' ? <p role="alert" className="mt-3 text-sm text-red-300">{givenError}</p> : null}
                </div>
              ) : null}
            </>
          ) : (
            <FeedbackEmptyState title="No feedback given yet" body="Feedback you submit on other pitches will appear here." />
          )}
        </div>
      )}
    </section>
  );
}
