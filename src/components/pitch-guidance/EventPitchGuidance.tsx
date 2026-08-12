'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, Sparkles, Target } from 'lucide-react';

export interface PitchGuidelineCriterion {
  id: string;
  label: string;
  description?: string | null;
}

export interface PitchGuidelines {
  title?: string | null;
  introduction?: string | null;
  version?: number | string | null;
  criteria: PitchGuidelineCriterion[];
}

export interface PitchBriefField {
  key: string;
  label: string;
  value: string;
  required: boolean;
  kind?: 'text' | 'textarea' | 'url' | 'select';
  maxLength?: number | null;
  options?: string[];
}

export interface PitchBriefGroup {
  id: string;
  label: string;
  description?: string;
  fields: PitchBriefField[];
}

export interface GuidanceAction {
  id: string;
  text: string;
  criterionLabel?: string | null;
  selected?: boolean;
  completed?: boolean;
  sourceLabel?: string | null;
}

interface Props {
  slug: string;
  guidelines: PitchGuidelines | null;
  groups: PitchBriefGroup[];
  actions: GuidanceAction[];
  recordHref: string;
  onSaved?: () => void;
}

export function EventPitchGuidance({ slug, guidelines, groups, actions, recordHref, onSaved }: Props) {
  const [draft, setDraft] = useState(() => Object.fromEntries(groups.flatMap((group) => group.fields.map((field) => [field.key, field.value || '']))));
  const [selected, setSelected] = useState(() => actions.filter((action) => action.selected && !action.completed).map((action) => action.id).slice(0, 2));
  const [savingBrief, setSavingBrief] = useState(false);
  const [savingActions, setSavingActions] = useState(false);
  const [status, setStatus] = useState('');

  const missing = useMemo(() => groups.flatMap((group) => group.fields).filter((field) => field.required && !String(draft[field.key] || '').trim()), [draft, groups]);
  const selectedActions = actions.filter((action) => selected.includes(action.id));
  const buildPracticeHref = (actionIds = selected) => {
    const [path, query = ''] = recordHref.split('?');
    const params = new URLSearchParams(query);
    params.set('practice', '1');
    if (selectedActions.length) {
      params.set('guidanceActionIds', actionIds.join(','));
      params.set('guidance', selectedActions.map((action) => action.text).join(' | '));
    }
    return `${path}?${params.toString()}`;
  };

  const saveBrief = async () => {
    setSavingBrief(true);
    setStatus('');
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(slug)}/founder-brief`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagline: draft.tagline || '',
          businessStage: draft.businessStage || '',
          industry: draft.industry || '',
          businessDescription: draft.businessDescription || '',
          problem: draft.problem || '',
          ask: draft.ask || '',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || 'Could not save your pitch brief.');
      setStatus(missing.length ? 'Draft saved. Complete the required items before your final submission.' : 'Pitch brief complete.');
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your pitch brief.');
    } finally {
      setSavingBrief(false);
    }
  };

  const saveActions = async (startPractice = false) => {
    if (!selected.length) return;
    setSavingActions(true);
    setStatus('');
    try {
      const results = await Promise.all(selected.map(async (feedbackId) => {
        const response = await fetch('/api/guidance-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.error || 'Could not save your practice focus.');
        return data;
      }));
      if (!results.length) return;
      setStatus('Practice focus saved. Take it into your next recording.');
      onSaved?.();
      if (startPractice && typeof window !== 'undefined') {
        const actionIds = results.map((result) => result.action?.id).filter(Boolean);
        window.location.assign(buildPracticeHref(actionIds.length ? actionIds : selected));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your practice focus.');
    } finally {
      setSavingActions(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {guidelines ? (
        <section aria-labelledby="pitch-standard-title" className="rounded-3xl border border-neon-cyan/20 bg-neon-cyan/[0.06] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-neon-cyan" aria-hidden="true" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">Pitch guidelines{guidelines.version ? ` · v${guidelines.version}` : ''}</p>
              <h2 id="pitch-standard-title" className="mt-1 font-heading text-2xl font-black text-white">{guidelines.title || 'What a strong pitch should cover'}</h2>
              {guidelines.introduction ? <p className="mt-2 text-sm leading-6 text-slate-300">{guidelines.introduction}</p> : null}
            </div>
          </div>
          {guidelines.criteria.length ? (
            <ol className="mt-4 grid gap-2 sm:grid-cols-2">
              {guidelines.criteria.map((criterion, index) => (
                <li key={criterion.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-bold text-white"><span className="mr-2 text-neon-cyan">{index + 1}.</span>{criterion.label}</p>
                  {criterion.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{criterion.description}</p> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      {groups.length ? (
        <section aria-labelledby="pitch-brief-title" className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-lime">Your pitch brief</p>
              <h2 id="pitch-brief-title" className="mt-1 font-heading text-2xl font-black text-white">Build the story before the recording</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${missing.length ? 'bg-amber-400/10 text-amber-300' : 'bg-neon-lime/15 text-neon-lime'}`}>{missing.length ? `${missing.length} required left` : 'Complete'}</span>
          </div>
          <div className="mt-4 space-y-3">
            {groups.map((group, index) => (
              <details key={group.id} open={index === 0 || group.fields.some((field) => field.required && !draft[field.key])} className="group rounded-2xl border border-white/10 bg-black/20">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
                  <span>{group.label}<span className="ml-2 text-xs font-medium text-slate-500">{group.fields.filter((field) => String(draft[field.key] || '').trim()).length}/{group.fields.length}</span></span>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-4 border-t border-white/10 p-4">
                  {group.description ? <p className="text-sm text-slate-400">{group.description}</p> : null}
                  {group.fields.map((field) => (
                    <label key={field.key} className="block text-sm font-bold text-white">
                      {field.label}{field.required ? <span className="ml-1 text-amber-300" aria-label="required">*</span> : null}
                      {field.kind === 'textarea' ? (
                        <textarea value={draft[field.key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} maxLength={field.maxLength || undefined} rows={4} className="input-dark mt-2 w-full resize-y" />
                      ) : field.kind === 'select' ? (
                        <select value={draft[field.key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} className="input-dark mt-2 w-full">
                          <option value="">Select one</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input type={field.kind === 'url' ? 'url' : 'text'} value={draft[field.key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} maxLength={field.maxLength || undefined} className="input-dark mt-2 w-full" />
                      )}
                      {field.maxLength ? <span className="mt-1 block text-right text-xs font-medium text-slate-500">{String(draft[field.key] || '').length}/{field.maxLength}</span> : null}
                    </label>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <button type="button" onClick={saveBrief} disabled={savingBrief} className="btn-glass mt-4 min-h-12 w-full rounded-2xl px-4 py-3 font-bold disabled:opacity-60">{savingBrief ? 'Saving…' : 'Save pitch brief'}</button>
          {missing.length ? <p className="mt-3 text-sm leading-6 text-amber-200" role="note">You can practice now. Your final event submission still needs: {missing.map((field) => field.label).join(', ')}.</p> : null}
        </section>
      ) : null}

      {actions.length ? (
        <section aria-labelledby="practice-focus-title" className="rounded-3xl border border-neon-lime/20 bg-neon-lime/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3"><Target className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" aria-hidden="true" /><div><p className="text-xs font-black uppercase tracking-[0.16em] text-neon-lime">Your next improvement</p><h2 id="practice-focus-title" className="mt-1 font-heading text-2xl font-black text-white">Choose 1–2 things to practice</h2></div></div>
          <div className="mt-4 space-y-2">
            {actions.map((action) => (
              <label key={action.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border p-3 ${action.completed ? 'border-white/10 bg-white/[0.03] opacity-70' : selected.includes(action.id) ? 'border-neon-lime/50 bg-neon-lime/10' : 'border-white/10 bg-black/20'}`}>
                <input type="checkbox" checked={selected.includes(action.id)} disabled={action.completed} onChange={() => setSelected((current) => current.includes(action.id) ? current.filter((id) => id !== action.id) : current.length < 2 ? [...current, action.id] : current)} className="mt-1 h-4 w-4 accent-[#CCFF00]" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{action.text}</span><span className="mt-1 block text-xs text-slate-400">{action.completed ? 'Addressed in a later take' : [action.criterionLabel, action.sourceLabel].filter(Boolean).join(' · ')}</span></span>
                {action.completed ? <Check className="h-4 w-4 text-neon-lime" aria-label="Completed" /> : null}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void saveActions()} disabled={!selected.length || savingActions} className="btn-glass min-h-12 rounded-2xl px-4 py-3 font-bold disabled:opacity-50">{savingActions ? 'Saving…' : 'Save practice focus'}</button>
            <button type="button" onClick={() => void saveActions(true)} disabled={!selected.length || savingActions} className="cta-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 font-heading font-black disabled:opacity-50"><Sparkles className="h-4 w-4" />Practice this feedback<ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>
      ) : null}
      {status ? <p role="status" className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-slate-200">{status}</p> : null}
    </div>
  );
}
