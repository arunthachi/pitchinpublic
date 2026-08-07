'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Link2, Loader2, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { readJsonResponse } from '@/lib/http';
import { validateDeckFile, validateDeckLink } from '@/lib/pitch-deck';

type DeckSummary = {
  kind: 'file' | 'link';
  fileName: string | null;
  linkHost: string | null;
  updatedAt: string | null;
};

/**
 * Self-contained pitch-deck block for the startup profile. Deck changes apply
 * immediately (file uploads cannot be deferred to a modal-level save): the
 * file path goes browser → signed URL → private bucket, then a confirm call
 * commits it; links save directly.
 */
export function DeckManager({ disabled }: { disabled?: boolean }) {
  const [deck, setDeck] = useState<DeckSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'upload' | 'link' | 'remove' | null>(null);
  const [error, setError] = useState('');
  const [linkDraft, setLinkDraft] = useState('');
  const [showLinkField, setShowLinkField] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    fetch('/api/startup/deck')
      .then((response) => readJsonResponse(response))
      .then((data) => {
        if (aliveRef.current && data?.success) setDeck(data.deck);
      })
      .catch(() => {})
      .finally(() => {
        if (aliveRef.current) setLoading(false);
      });
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const uploadFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setError('');

    const validation = validateDeckFile({ fileName: file.name, fileSize: file.size, mimeType: file.type });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setBusy('upload');
    try {
      const urlResponse = await fetch('/api/startup/deck/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
      });
      const urlData = await readJsonResponse(urlResponse);
      if (!urlResponse.ok || !urlData.success) throw new Error(urlData.error || 'Could not start the upload.');

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(urlData.bucket)
        .uploadToSignedUrl(urlData.storagePath, urlData.token, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error('The upload failed. Check your connection and try again.');

      const confirmResponse = await fetch('/api/startup/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'file',
          storagePath: urlData.storagePath,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      const confirmData = await readJsonResponse(confirmResponse);
      if (!confirmResponse.ok || !confirmData.success) throw new Error(confirmData.error || 'Could not save the deck.');

      if (!aliveRef.current) return;
      setDeck(confirmData.deck);
      setShowLinkField(false);
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : 'Could not upload the deck.');
    } finally {
      if (aliveRef.current) setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveLink = async () => {
    if (busy) return;
    setError('');
    const validation = validateDeckLink(linkDraft);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setBusy('link');
    try {
      const response = await fetch('/api/startup/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'link', url: validation.url }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save the link.');
      if (!aliveRef.current) return;
      setDeck(data.deck);
      setLinkDraft('');
      setShowLinkField(false);
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : 'Could not save the link.');
    } finally {
      if (aliveRef.current) setBusy(null);
    }
  };

  const removeDeck = async () => {
    if (busy) return;
    setError('');
    setBusy('remove');
    try {
      const response = await fetch('/api/startup/deck', { method: 'DELETE' });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not remove the deck.');
      if (aliveRef.current) setDeck(null);
    } catch (err) {
      if (aliveRef.current) setError(err instanceof Error ? err.message : 'Could not remove the deck.');
    } finally {
      if (aliveRef.current) setBusy(null);
    }
  };

  const inputsDisabled = disabled || busy !== null || loading;

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-slate-300">
        Pitch deck <span className="text-xs font-normal text-slate-500">(optional — visible to your event organizers)</span>
      </span>

      {loading ? (
        <p className="text-sm text-slate-500">Loading deck…</p>
      ) : deck ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3">
          {deck.kind === 'file' ? <FileText className="h-4 w-4 shrink-0 text-neon-cyan" /> : <Link2 className="h-4 w-4 shrink-0 text-neon-cyan" />}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
            {deck.kind === 'file' ? deck.fileName : deck.linkHost}
          </span>
          <button
            type="button"
            disabled={inputsDisabled}
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-xs font-bold text-slate-300 transition hover:border-neon-cyan/45 hover:text-white disabled:opacity-60"
          >
            {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Replace
          </button>
          <button
            type="button"
            disabled={inputsDisabled}
            onClick={removeDeck}
            aria-label="Remove pitch deck"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-roast/45 hover:text-roast disabled:opacity-60"
          >
            {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={inputsDisabled}
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-300 transition hover:border-neon-cyan/45 hover:text-white disabled:opacity-60"
          >
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload PDF or PPT
          </button>
          {showLinkField ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="url"
                value={linkDraft}
                onChange={(event) => setLinkDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveLink();
                  }
                }}
                placeholder="https://drive.google.com/…"
                disabled={inputsDisabled}
                aria-label="Pitch deck link"
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white placeholder:text-slate-500 focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
              <button
                type="button"
                disabled={inputsDisabled || !linkDraft.trim()}
                onClick={saveLink}
                className="inline-flex min-h-11 items-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 text-sm font-bold text-neon-cyan transition hover:bg-neon-cyan/20 disabled:opacity-60"
              >
                {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={inputsDisabled}
              onClick={() => setShowLinkField(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-slate-400 transition hover:text-white disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" />
              or paste a Drive link
            </button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(event) => uploadFile(event.target.files?.[0])}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-roast">{error}</p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-500">PDF, PPT, or PPTX up to 25MB — or a link. Only you and the teams of events you join can open it.</p>
      )}
    </div>
  );
}
