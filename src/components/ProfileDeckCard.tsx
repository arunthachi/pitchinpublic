'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Link2, Loader2, Upload } from 'lucide-react';

type DeckSummary = {
  kind: 'file' | 'link';
  fileName: string | null;
  linkHost: string | null;
  updatedAt: string | null;
};

type ProfileDeckCardProps = {
  /** Opens the profile editor, where DeckManager handles add/replace/remove. */
  onManage: () => void;
};

function deckLabel(deck: DeckSummary) {
  if (deck.kind === 'link') return deck.linkHost ? `Link · ${deck.linkHost}` : 'Deck link';
  return deck.fileName || 'Pitch deck';
}

/**
 * The founder's own view of their deck. Until this existed the deck was only
 * reachable inside the edit modal, so founders uploaded one and never saw it
 * again — organizers could view it but the owner could not.
 */
export default function ProfileDeckCard({ onManage }: ProfileDeckCardProps) {
  const [deck, setDeck] = useState<DeckSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/startup/deck', { signal: controller.signal, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.success) setDeck(data.deck || null);
      })
      .catch(() => {
        /* A missing startup profile or transient failure just shows the add prompt. */
      })
      .finally(() => {
        // Skip on the aborted path, otherwise the AbortController buys nothing
        // and an unmounted card still sets state.
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const openDeck = useCallback(async () => {
    setOpening(true);
    setError('');
    // Opened synchronously so the popup blocker attributes it to this click;
    // the signed URL is filled in once the request resolves. `noopener` must
    // NOT go in the features string — Chrome and Firefox then return null, and
    // the fallback below would replace the profile instead of opening a tab.
    // The opener reference is severed manually instead.
    const target = window.open('', '_blank');
    if (target) target.opener = null;
    try {
      const response = await fetch('/api/startup/deck/view', { cache: 'no-store' });
      // A 502 from the edge returns HTML; raw .json() would surface
      // "Unexpected token <" to the founder as if it were our copy.
      const raw = await response.text();
      let data: { success?: boolean; url?: string; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Could not open your deck.');
      }
      if (target) target.location.href = data.url;
      else window.location.href = data.url;
    } catch (err) {
      target?.close();
      setError(err instanceof Error ? err.message : 'Could not open your deck.');
    } finally {
      setOpening(false);
    }
  }, []);

  if (loading) return null;

  return (
    <section
      aria-labelledby="profile-deck-heading"
      className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-neon-cyan">
            {deck?.kind === 'link' ? (
              <Link2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <FileText className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h2
              id="profile-deck-heading"
              className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
            >
              Pitch deck
            </h2>
            <p className="truncate text-sm font-bold text-white">
              {deck ? deckLabel(deck) : 'No deck yet'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {deck ? (
            <button
              type="button"
              onClick={openDeck}
              disabled={opening}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-slate-950 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:opacity-60"
            >
              {opening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {opening ? 'Opening…' : 'Open'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onManage}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-200 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {deck ? null : <Upload className="h-4 w-4" aria-hidden="true" />}
            {deck ? 'Replace' : 'Add pitch deck'}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {deck
          ? 'Organizers of events you join can view this deck alongside your pitch.'
          : 'Optional. Organizers of events you join can view it alongside your pitch.'}
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-roast">
          {error}
        </p>
      ) : null}
    </section>
  );
}
