'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Eye, Pencil, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { createClientIdempotencyKey } from '@/lib/idempotency';

type Criterion = { id?: string; key: string; label: string; guidance: string };
type Standard = {
  title: string;
  instructions: string;
  criteria: Criterion[];
  disclosureMode: 'named' | 'role_only' | 'anonymous_to_founder';
  revision?: number;
  version?: number;
  updatedAt?: string;
};

const RECOMMENDED_STANDARD: Standard = {
  title: 'A clear, audience-ready pitch',
  instructions: 'Use this plan to prepare a focused pitch that your audience can understand and act on.',
  disclosureMode: 'role_only',
  criteria: [
    { key: 'audience', label: 'Who is this for?', guidance: 'Name the audience or people you want to reach.' },
    { key: 'need', label: 'What need, problem, or opportunity exists?', guidance: 'Make the situation concrete and worth addressing.' },
    { key: 'offering', label: 'What are you offering or proposing?', guidance: 'Explain the idea clearly and without unnecessary detail.' },
    { key: 'credibility', label: 'Why should the audience believe it?', guidance: 'Share the strongest evidence, progress, or reason to trust the approach.' },
    { key: 'ask', label: 'What do you want them to do next?', guidance: 'End with one specific and realistic ask.' },
    { key: 'delivery', label: 'Can you communicate it clearly within the time?', guidance: 'Use a concise structure and confident delivery.' },
  ],
};

function normalizeCriterion(value: any, index: number): Criterion {
  return {
    id: value?.id,
    key: value?.key || `criterion_${index + 1}`,
    label: value?.label || value?.title || value?.name || '',
    guidance: value?.guidance || value?.description || '',
  };
}

function normalizeStandard(value: any): Standard | null {
  if (!value) return null;
  const criteria = Array.isArray(value.criteria) ? value.criteria.map(normalizeCriterion) : [];
  return {
    title: value.title || RECOMMENDED_STANDARD.title,
    instructions: value.instructions || value.founderInstructions || value.founder_instructions || '',
    criteria: criteria.length ? criteria : RECOMMENDED_STANDARD.criteria,
    disclosureMode: value.disclosureMode || value.disclosure_mode || 'role_only',
    revision: Number.isFinite(Number(value.revision)) ? Number(value.revision) : undefined,
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : undefined,
    updatedAt: value.updatedAt || value.updated_at || value.created_at,
  };
}

function formatUpdated(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PitchGuidelinesEditor({ eventSlug, canManage, initiallyOpen = false }: {
  eventSlug: string;
  canManage: boolean;
  initiallyOpen?: boolean;
}) {
  const [draft, setDraft] = useState<Standard>(RECOMMENDED_STANDARD);
  const [published, setPublished] = useState<Standard | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(initiallyOpen);
  const [saving, setSaving] = useState<'draft' | 'publish' | ''>('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const editHeadingRef = useRef<HTMLHeadingElement>(null);
  const publishKeyRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setConflict(false);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/guidelines`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load the pitch standard.');
      const nextPublished = normalizeStandard(data.published || data.guideline || data.guidelines?.[0]);
      const nextDraft = normalizeStandard(data.draft) || nextPublished || RECOMMENDED_STANDARD;
      setPublished(nextPublished);
      setDraft(nextDraft);
      if (!nextPublished) setExpanded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the pitch standard.');
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => { void load(); }, [load]);

  const payload = useMemo(() => ({
    title: draft.title,
    instructions: draft.instructions,
    criteria: draft.criteria,
    disclosureMode: draft.disclosureMode,
    revision: draft.revision,
  }), [draft]);

  const valid = draft.title.trim().length >= 2
    && draft.criteria.length >= 4
    && draft.criteria.length <= 6
    && draft.criteria.every((item) => item.key.trim() && item.label.trim().length >= 2);

  const save = async (action: 'draft' | 'publish') => {
    if (saving || !valid) return;
    setSaving(action);
    setMessage('');
    setConflict(false);
    try {
      let revision = draft.revision;
      if (action === 'draft' || editing) {
        const draftResponse = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/guidelines`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const draftData = await draftResponse.json().catch(() => ({}));
        if (draftResponse.status === 409) {
          setConflict(true);
          throw new Error('This draft changed in another session. Reload the latest draft before continuing.');
        }
        if (!draftResponse.ok || draftData.success === false) throw new Error(draftData.error || 'Could not save the pitch standard draft.');
        const savedDraft = normalizeStandard(draftData.draft) || draft;
        setDraft(savedDraft);
        revision = savedDraft.revision;
        if (action === 'draft') {
          setEditing(false);
          setExpanded(true);
          setMessage('Draft saved.');
          return;
        }
      }
      const response = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/guidelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision,
          idempotencyKey: publishKeyRef.current || (publishKeyRef.current = createClientIdempotencyKey()),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setConflict(true);
        throw new Error('This draft changed in another session. Reload the latest draft before continuing.');
      }
      if (!response.ok || data.success === false) throw new Error(data.error || 'Could not publish the pitch standard.');
      const nextPublished = normalizeStandard(data.published || data.guideline);
      const nextDraft = normalizeStandard(data.draft) || nextPublished || draft;
      setDraft(nextDraft);
      if (nextPublished) setPublished(nextPublished);
      setEditing(false);
      setExpanded(true);
      setMessage('Pitch standard published. Founders can now record against it.');
      publishKeyRef.current = '';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the pitch standard.');
    } finally {
      setSaving('');
    }
  };

  const startEditing = () => {
    setEditing(true);
    setExpanded(true);
    setMessage('');
    window.requestAnimationFrame(() => editHeadingRef.current?.focus());
  };

  return (
    <section id="pitch-guidelines" className="scroll-mt-24 rounded-3xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/[0.09] to-white/[0.03] p-4 sm:p-6" aria-labelledby="pitch-standard-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">Founder guidance</p>
          <h2 id="pitch-standard-title" className="mt-1 font-heading text-2xl font-black">Pitch standard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {published ? 'This is the plan founders prepare against and reviewers use for structured feedback.' : 'Set what a successful pitch should cover before founders begin recording.'}
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${published ? 'bg-neon-lime/15 text-neon-lime' : 'bg-amber-400/15 text-amber-300'}`}>
          {published ? 'Published' : 'Setup required'}
        </span>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3" aria-label="Loading pitch standard"><div className="h-14 animate-pulse rounded-2xl bg-white/[0.06]" /><div className="h-14 animate-pulse rounded-2xl bg-white/[0.06]" /></div>
      ) : (
        <div className="mt-5">
          {!editing ? (
            <div>
              <button type="button" aria-expanded={expanded} aria-controls="pitch-standard-details" onClick={() => setExpanded((value) => !value)} className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
                <span><strong className="block font-heading text-base text-white">{published?.title || draft.title}</strong><span className="mt-1 block text-xs text-slate-400">{published?.updatedAt ? `Updated ${formatUpdated(published.updatedAt)}` : 'Recommended universal starting standard'}</span></span>
                <span className="text-sm font-bold text-neon-cyan">{expanded ? 'Hide' : 'Review'}</span>
              </button>
              {expanded ? (
                <div id="pitch-standard-details" className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(published?.criteria || draft.criteria).map((criterion, index) => (
                    <article key={criterion.key} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black text-neon-cyan">{index + 1}</p><h3 className="mt-1 font-heading text-sm font-black text-white">{criterion.label}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{criterion.guidance}</p></article>
                  ))}
                </div>
              ) : null}

              {canManage ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {!published ? <button type="button" disabled={Boolean(saving)} onClick={() => void save('publish')} className="cta-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-heading font-black disabled:opacity-50"><Check className="h-4 w-4" />{saving === 'publish' ? 'Publishing…' : 'Use and publish this standard'}</button> : null}
                  <button type="button" disabled={Boolean(saving)} onClick={startEditing} className="btn-glass inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold disabled:opacity-50"><Pencil className="h-4 w-4" />{published ? 'Create updated version' : 'Customize'}</button>
                  <Link href={`/events/${encodeURIComponent(eventSlug)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold text-slate-300 hover:bg-white/[0.05]"><Eye className="h-4 w-4" />Preview founder experience</Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <h3 ref={editHeadingRef} tabIndex={-1} className="font-heading text-lg font-black outline-none">Customize pitch standard</h3>
              {published ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">Publishing creates a new version for future takes. Existing takes and feedback stay connected to the standard used when they were recorded.</p> : null}
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-200">Standard title</span><input className="input-dark" value={draft.title} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-200">Instructions for founders</span><textarea className="input-dark min-h-24 resize-y" value={draft.instructions} maxLength={3000} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></label>
              <div>
                <div className="flex items-center justify-between gap-3"><div><h4 className="font-heading font-black">Pitch and feedback criteria</h4><p className="mt-1 text-xs text-slate-400">Use 4–6 concise criteria.</p></div><button type="button" disabled={draft.criteria.length >= 6} onClick={() => setDraft({ ...draft, criteria: [...draft.criteria, { key: `criterion_${Date.now()}`, label: '', guidance: '' }] })} className="btn-glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-40"><Plus className="h-4 w-4" />Add</button></div>
                <div className="mt-3 space-y-3">{draft.criteria.map((criterion, index) => <div key={criterion.id || criterion.key} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[0.8fr_1.2fr_auto] sm:items-center"><label><span className="sr-only">Criterion {index + 1}</span><input className="input-dark" value={criterion.label} placeholder="What should the pitch cover?" onChange={(event) => setDraft({ ...draft, criteria: draft.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} /></label><label><span className="sr-only">Guidance for criterion {index + 1}</span><input className="input-dark" value={criterion.guidance} placeholder="What should founders and reviewers look for?" onChange={(event) => setDraft({ ...draft, criteria: draft.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, guidance: event.target.value } : item) })} /></label><button type="button" aria-label={`Remove ${criterion.label || `criterion ${index + 1}`}`} disabled={draft.criteria.length <= 4} onClick={() => setDraft({ ...draft, criteria: draft.criteria.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 hover:bg-roast/10 hover:text-roast disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={Boolean(saving) || !valid} onClick={() => void save('draft')} className="btn-glass inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold disabled:opacity-50"><Save className="h-4 w-4" />{saving === 'draft' ? 'Saving…' : 'Save draft'}</button><button type="button" disabled={Boolean(saving) || !valid} onClick={() => void save('publish')} className="cta-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-black disabled:opacity-50"><Send className="h-4 w-4" />{saving === 'publish' ? 'Publishing…' : published ? 'Publish updated version' : 'Publish'}</button><button type="button" disabled={Boolean(saving)} onClick={() => { setEditing(false); setMessage(''); }} className="min-h-12 rounded-xl px-5 font-bold text-slate-400 hover:bg-white/[0.05]">Cancel</button></div>
            </div>
          )}

          {message ? <div role={conflict ? 'alert' : 'status'} className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${conflict ? 'border-amber-400/25 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-black/25 text-slate-200'}`}><p>{message}</p>{conflict ? <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 font-bold"><RefreshCw className="h-4 w-4" />Reload latest draft</button> : null}</div> : null}
        </div>
      )}
    </section>
  );
}
