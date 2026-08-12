'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Save, Send, Trash2 } from 'lucide-react';

type Criterion = { id?: string; key?: string; title: string; guidance: string };
type GuidelineDraft = {
  title: string;
  founderInstructions: string;
  criteria: Criterion[];
  status?: 'draft' | 'published';
  version?: number;
  disclosureMode?: 'named' | 'role_only' | 'anonymous_to_founder';
};

const EMPTY_DRAFT: GuidelineDraft = {
  title: 'Pitch guidelines',
  founderInstructions: '',
  criteria: [
    { title: 'Clear problem', guidance: 'Make the customer and their problem specific.' },
    { title: 'Compelling solution', guidance: 'Explain why this approach is meaningfully better.' },
    { title: 'Specific ask', guidance: 'End with the one action you want from this audience.' },
    { title: 'Delivery', guidance: 'Make the pitch concise, confident, and easy to follow.' },
  ],
  status: 'draft',
  disclosureMode: 'role_only',
};

function normalizeGuideline(data: any): GuidelineDraft {
  const source = data?.guideline || data?.draft || data?.published || data?.guidelines?.[0];
  if (!source) return EMPTY_DRAFT;
  return {
    title: source.title || EMPTY_DRAFT.title,
    founderInstructions: source.founderInstructions || source.founder_instructions || source.instructions || '',
    criteria: (source.criteria || EMPTY_DRAFT.criteria).map((criterion: any) => ({
      id: criterion.id,
      key: criterion.key,
      title: criterion.title || criterion.label || criterion.name || '',
      guidance: criterion.guidance || criterion.description || '',
    })),
    status: 'published',
    version: source.version,
    disclosureMode: source.disclosure_mode || source.disclosureMode || 'role_only',
  };
}

export function PitchGuidelinesEditor({ eventSlug, canManage, initiallyOpen = false }: {
  eventSlug: string;
  canManage: boolean;
  initiallyOpen?: boolean;
}) {
  const [draft, setDraft] = useState<GuidelineDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'publish' | ''>('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const localDraft = window.localStorage.getItem(`pip.event-guidelines-draft.${eventSlug}`);
      if (localDraft) setDraft(JSON.parse(localDraft));
      const response = await fetch(`/api/events/${eventSlug}/guidelines`);
      if (response.status === 404) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load pitch guidelines.');
      if (!localDraft) setDraft(normalizeGuideline(data));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load pitch guidelines.');
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => { load(); }, [load]);

  const save = async (action: 'draft' | 'publish') => {
    setSaving(action);
    setMessage('');
    try {
      if (action === 'draft') {
        window.localStorage.setItem(`pip.event-guidelines-draft.${eventSlug}`, JSON.stringify({ ...draft, status: 'draft' }));
        setDraft({ ...draft, status: 'draft' });
        setMessage('Draft saved on this device.');
        return;
      }
      const response = await fetch(`/api/events/${eventSlug}/guidelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          instructions: draft.founderInstructions,
          criteria: draft.criteria.map((criterion, index) => ({
            key: criterion.key || `criterion_${index + 1}`,
            label: criterion.title,
            guidance: criterion.guidance,
          })),
          disclosureMode: draft.disclosureMode || 'role_only',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || 'Could not save pitch guidelines.');
      setDraft(normalizeGuideline(data.guideline ? data : { guideline: { ...draft, status: action === 'publish' ? 'published' : 'draft' } }));
      window.localStorage.removeItem(`pip.event-guidelines-draft.${eventSlug}`);
      setMessage(action === 'publish' ? 'Guidelines published to founders.' : 'Draft saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save pitch guidelines.');
    } finally {
      setSaving('');
    }
  };

  return (
    <section id="pitch-guidelines" className="scroll-mt-24 rounded-3xl border border-neon-cyan/20 bg-neon-cyan/[0.06] p-4 sm:p-6" aria-labelledby="pitch-guidelines-title">
      <details open={initiallyOpen}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">Founder standard</p>
            <h2 id="pitch-guidelines-title" className="mt-1 font-heading text-xl font-black">Pitch guidelines</h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
            {draft.status === 'published' ? `Published${draft.version ? ` · v${draft.version}` : ''}` : 'Draft'}
          </span>
        </summary>

        <div className="mt-5">
          {loading ? <p className="text-sm text-slate-400">Loading guidelines…</p> : (
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">Guideline title</span>
                <input className="input-dark" value={draft.title} disabled={!canManage} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">Instructions for founders</span>
                <textarea className="input-dark min-h-28 resize-y" value={draft.founderInstructions} disabled={!canManage} maxLength={3000} placeholder="Share the pitch structure, audience, examples, and what success looks like." onChange={(event) => setDraft({ ...draft, founderInstructions: event.target.value })} />
              </label>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-black">Feedback criteria</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Reviewers use these criteria to give comparable, actionable feedback.</p>
                  </div>
                  {canManage ? <button type="button" disabled={draft.criteria.length >= 6} onClick={() => setDraft({ ...draft, criteria: [...draft.criteria, { title: '', guidance: '' }] })} className="btn-glass inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-40"><Plus className="h-4 w-4" />Add</button> : null}
                </div>
                <div className="mt-3 space-y-3">
                  {draft.criteria.map((criterion, index) => (
                    <div key={criterion.id || index} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[0.7fr_1.3fr_auto] sm:items-center">
                      <label><span className="sr-only">Criterion {index + 1} name</span><input className="input-dark" disabled={!canManage} value={criterion.title} placeholder="Criterion name" onChange={(event) => setDraft({ ...draft, criteria: draft.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} /></label>
                      <label><span className="sr-only">Criterion {index + 1} guidance</span><input className="input-dark" disabled={!canManage} value={criterion.guidance} placeholder="What should reviewers look for?" onChange={(event) => setDraft({ ...draft, criteria: draft.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, guidance: event.target.value } : item) })} /></label>
                      {canManage ? <button type="button" aria-label={`Remove ${criterion.title || `criterion ${index + 1}`}`} disabled={draft.criteria.length <= 4} onClick={() => setDraft({ ...draft, criteria: draft.criteria.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 hover:bg-roast/10 hover:text-roast disabled:opacity-30"><Trash2 className="h-4 w-4" /></button> : null}
                    </div>
                  ))}
                </div>
              </div>

              {message ? <p role="status" className="text-sm font-semibold text-slate-200">{message}</p> : null}
              {canManage ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" disabled={Boolean(saving)} onClick={() => save('draft')} className="btn-glass inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:opacity-50"><Save className="h-4 w-4" />{saving === 'draft' ? 'Saving…' : 'Save draft'}</button>
                  <button type="button" disabled={Boolean(saving) || draft.criteria.length < 4 || draft.criteria.length > 6 || !draft.title.trim() || draft.criteria.some((item) => !item.title.trim())} onClick={() => save('publish')} className="cta-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-black disabled:opacity-50">{saving === 'publish' ? <Send className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}{saving === 'publish' ? 'Publishing…' : 'Publish to founders'}</button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
