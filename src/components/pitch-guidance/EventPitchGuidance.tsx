'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen, Check, ChevronDown, Sparkles, Target, X } from 'lucide-react';

export interface PitchGuidelineCriterion { id: string; label: string; description?: string | null }
export interface PitchGuidelines { id?: string | null; title?: string | null; introduction?: string | null; version?: number | string | null; updatedAt?: string | null; criteria: PitchGuidelineCriterion[] }
export interface PitchBriefField { key: string; label: string; value: string; required: boolean; kind?: 'text' | 'textarea' | 'url' | 'select' | 'combobox'; maxLength?: number | null; options?: string[] }
export interface PitchBriefGroup { id: string; label: string; description?: string; fields: PitchBriefField[] }
export interface GuidanceAction { id: string; text: string; criterionLabel?: string | null; selected?: boolean; completed?: boolean; sourceLabel?: string | null }

export const BUSINESS_STAGE_OPTIONS = ['Idea', 'Pre-revenue', 'Revenue-generating', 'Growth', 'Established'];
export const INDUSTRY_OPTIONS = [
  'Agriculture & Food', 'Arts & Entertainment', 'Consumer Products & Services', 'Education',
  'Energy & Climate', 'Financial Services', 'Government & Public Sector', 'Healthcare',
  'Hospitality & Travel', 'Manufacturing', 'Media & Communications', 'Nonprofit & Social Impact',
  'Professional Services', 'Real Estate & Construction', 'Retail & E-commerce', 'Technology',
  'Transportation & Logistics', 'Other',
];

export function pitchPlanMissingFields(groups: PitchBriefGroup[], values: Record<string, string>) {
  return groups.flatMap((group) => group.fields).filter((field) => field.required && !String(values[field.key] || '').trim());
}

export function PitchPlanFields({ groups, values, onChange }: { groups: PitchBriefGroup[]; values: Record<string, string>; onChange: (key: string, value: string) => void }) {
  const optionsIdPrefix = useId();
  return <div className="space-y-3">{groups.map((group, index) => (
    <details key={group.id} open={index === 0 || group.fields.some((field) => field.required && !values[field.key])} className="group rounded-2xl border border-white/10 bg-black/20">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
        <span>{group.label}<span className="ml-2 text-xs font-medium text-slate-500">{group.fields.filter((field) => String(values[field.key] || '').trim()).length}/{group.fields.length}</span></span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-white/10 p-4">
        {group.description ? <p className="text-sm text-slate-400">{group.description}</p> : null}
        {group.fields.map((field) => {
          const optionsId = `${optionsIdPrefix}-${field.key.replace(/[^a-z0-9_-]/gi, '-')}-options`;
          return <label key={field.key} className="block text-sm font-bold text-white">
          {field.label}{field.required ? <span className="ml-1 text-amber-300" aria-label="required">*</span> : <span className="ml-2 text-xs font-medium text-slate-500">Optional</span>}
          {field.kind === 'textarea' ? <textarea value={values[field.key] || ''} onChange={(event) => onChange(field.key, event.target.value)} maxLength={field.maxLength || undefined} rows={4} className="input-dark mt-2 w-full resize-y" />
            : field.kind === 'select' ? <select value={values[field.key] || ''} onChange={(event) => onChange(field.key, event.target.value)} className="input-dark mt-2 w-full"><option value="">Select one</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
            : field.kind === 'combobox' ? <><input type="text" list={optionsId} value={values[field.key] || ''} onChange={(event) => onChange(field.key, event.target.value)} placeholder="Select or type an industry" className="input-dark mt-2 w-full" /><datalist id={optionsId}>{field.options?.map((option) => <option key={option} value={option} />)}</datalist></>
            : <input type={field.kind === 'url' ? 'url' : 'text'} value={values[field.key] || ''} onChange={(event) => onChange(field.key, event.target.value)} maxLength={field.maxLength || undefined} className="input-dark mt-2 w-full" />}
          {field.maxLength ? <span className="mt-1 block text-right text-xs font-medium text-slate-500">{String(values[field.key] || '').length}/{field.maxLength}</span> : null}
        </label>})}
      </div>
    </details>
  ))}</div>;
}

export function PitchPlanSheet({ open, onClose, guidelines, groups, values, onChange, activeRecording = false, onSave, saving = false }: {
  open: boolean; onClose: () => void; guidelines: PitchGuidelines | null; groups: PitchBriefGroup[]; values: Record<string, string>; onChange: (key: string, value: string) => void; activeRecording?: boolean; onSave?: () => void; saving?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); returnFocus.current?.focus(); };
  }, [onClose, open]);
  if (activeRecording) return null;
  return <AnimatePresence>{open ? <>
    <motion.button type="button" aria-label="Close pitch plan" onClick={onClose} className="fixed inset-0 z-[110] cursor-default bg-black/70 backdrop-blur-sm" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.section role="dialog" aria-modal="true" aria-labelledby="studio-plan-title" className="fixed inset-x-0 bottom-0 z-[120] max-h-[88dvh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-950 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[28rem] sm:rounded-[2rem] sm:pb-5" initial={reduceMotion ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">Pitch plan{guidelines?.version ? ` · v${guidelines.version}` : ''}</p><h2 id="studio-plan-title" className="mt-1 font-heading text-2xl font-black text-white">{guidelines?.title || 'Prepare your pitch'}</h2></div><button ref={closeRef} type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white focus-visible:ring-2 focus-visible:ring-neon-cyan" aria-label="Close pitch plan"><X className="h-5 w-5" /></button></div>
      {guidelines?.introduction ? <p className="mt-3 text-sm leading-6 text-slate-300">{guidelines.introduction}</p> : null}
      <ol className="mt-4 space-y-2">{guidelines?.criteria.map((criterion, index) => <li key={criterion.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-sm font-bold text-white"><span className="mr-2 text-neon-cyan">{index + 1}.</span>{criterion.label}</p>{criterion.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{criterion.description}</p> : null}</li>)}</ol>
      {groups.length ? <div className="mt-5"><h3 className="mb-3 font-heading text-lg font-black text-white">Your preparation</h3><PitchPlanFields groups={groups} values={values} onChange={onChange} />{onSave ? <button type="button" onClick={onSave} disabled={saving} className="cta-primary mt-4 min-h-12 w-full rounded-2xl px-4 font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save pitch plan'}</button> : null}</div> : null}
    </motion.section>
  </> : null}</AnimatePresence>;
}

interface Props { slug: string; guidelines: PitchGuidelines | null; groups: PitchBriefGroup[]; actions: GuidanceAction[]; recordHref: string; onSaved?: () => void }

export function EventPitchGuidance({ slug, guidelines, groups, actions, recordHref, onSaved }: Props) {
  const [draft, setDraft] = useState(() => Object.fromEntries(groups.flatMap((group) => group.fields.map((field) => [field.key, field.value || '']))));
  const [selected, setSelected] = useState(() => actions.filter((action) => action.selected && !action.completed).map((action) => action.id).slice(0, 2));
  const [savingBrief, setSavingBrief] = useState(false); const [savingActions, setSavingActions] = useState(false); const [status, setStatus] = useState('');
  useEffect(() => { setDraft(Object.fromEntries(groups.flatMap((group) => group.fields.map((field) => [field.key, field.value || ''])))); }, [groups]);
  useEffect(() => { setSelected(actions.filter((action) => action.selected && !action.completed).map((action) => action.id).slice(0, 2)); }, [actions]);
  const missing = useMemo(() => pitchPlanMissingFields(groups, draft), [draft, groups]);
  const selectedActions = actions.filter((action) => selected.includes(action.id));
  const buildPracticeHref = (actionIds = selected) => { const [path, query = ''] = recordHref.split('?'); const params = new URLSearchParams(query); params.set('practice', '1'); params.set('guidanceActionIds', actionIds.join(',')); params.set('guidance', selectedActions.map((action) => action.text).join(' | ')); return `${path}?${params.toString()}`; };
  const saveBrief = async () => { setSavingBrief(true); setStatus(''); try { const response = await fetch(`/api/events/${encodeURIComponent(slug)}/founder-brief`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagline: draft.tagline || '', businessStage: draft.businessStage || '', industry: draft.industry || '', businessDescription: draft.businessDescription || '', problem: draft.problem || '', ask: draft.ask || '' }) }); const data = await response.json().catch(() => ({})); if (!response.ok || data.success === false) throw new Error(data.error || 'Could not save your pitch plan.'); setStatus(missing.length ? 'Progress saved. Complete the required items before final submission.' : 'Pitch plan complete.'); onSaved?.(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save your pitch plan.'); } finally { setSavingBrief(false); } };
  const saveActions = async (startPractice = false) => { if (!selected.length) return; setSavingActions(true); setStatus(''); try { const results = await Promise.all(selected.map(async (feedbackId) => { const response = await fetch('/api/guidance-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedbackId }) }); const data = await response.json().catch(() => ({})); if (!response.ok || data.success === false) throw new Error(data.error || 'Could not save your practice focus.'); return data; })); setStatus('Practice focus saved.'); onSaved?.(); if (startPractice) window.location.assign(buildPracticeHref(results.map((result) => result.action?.id).filter(Boolean))); } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save your practice focus.'); } finally { setSavingActions(false); } };
  if (!guidelines) return <section className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5" aria-labelledby="plan-preparing-title"><BookOpen className="h-5 w-5 text-amber-300" /><h2 id="plan-preparing-title" className="mt-3 font-heading text-2xl font-black text-white">Pitch standard in preparation</h2><p className="mt-2 text-sm leading-6 text-slate-300">The organizer is preparing the pitch plan. You can explore the event, but event recording and final submission open after it is published.</p></section>;
  return <section className="mt-6 rounded-3xl border border-neon-cyan/20 bg-neon-cyan/[0.05] p-5 sm:p-6" aria-labelledby="your-pitch-plan-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">Your pitch plan</p><h2 id="your-pitch-plan-title" className="mt-1 font-heading text-2xl font-black text-white">{guidelines.title || 'Prepare a clear, useful pitch'}</h2><p className="mt-2 text-sm text-slate-400">{missing.length ? `${missing.length} required preparation item${missing.length === 1 ? '' : 's'} left` : 'Ready for final submission'}{guidelines.updatedAt ? ` · Updated ${new Date(guidelines.updatedAt).toLocaleDateString()}` : ''}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${missing.length ? 'bg-amber-300/10 text-amber-200' : 'bg-neon-lime/15 text-neon-lime'}`}>{missing.length ? `${groups.flatMap((g) => g.fields).length - missing.length}/${groups.flatMap((g) => g.fields).length}` : 'Complete'}</span></div>
    {guidelines.introduction ? <p className="mt-3 text-sm leading-6 text-slate-300">{guidelines.introduction}</p> : null}
    <ol className="mt-4 space-y-2">{guidelines.criteria.map((criterion, index) => <li key={criterion.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-sm font-bold text-white"><span className="mr-2 text-neon-cyan">{index + 1}.</span>{criterion.label}</p>{criterion.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{criterion.description}</p> : null}</li>)}</ol>
    {groups.length ? <div className="mt-4"><PitchPlanFields groups={groups} values={draft} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} /><button type="button" onClick={saveBrief} disabled={savingBrief} className="btn-glass mt-4 min-h-12 w-full rounded-2xl px-4 font-bold disabled:opacity-50">{savingBrief ? 'Saving…' : missing.length ? 'Save and continue preparing' : 'Save pitch plan'}</button>{missing.length ? <p className="mt-3 text-sm text-amber-100">Practice is available now. Final submission still needs: {missing.map((field) => field.label).join(', ')}.</p> : null}</div> : null}
    {actions.length ? <div className="mt-5 border-t border-white/10 pt-5"><div className="flex gap-3"><Target className="h-5 w-5 text-neon-lime" /><div><p className="text-xs font-black uppercase tracking-[0.16em] text-neon-lime">Next improvement</p><h3 className="font-heading text-lg font-black text-white">Choose 1–2 things to practice</h3></div></div><div className="mt-3 space-y-2">{actions.map((action) => <label key={action.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border p-3 ${action.completed ? 'opacity-60' : selected.includes(action.id) ? 'border-neon-lime/50 bg-neon-lime/10' : 'border-white/10 bg-black/20'}`}><input type="checkbox" checked={selected.includes(action.id)} disabled={action.completed} onChange={() => setSelected((current) => current.includes(action.id) ? current.filter((id) => id !== action.id) : current.length < 2 ? [...current, action.id] : current)} className="mt-1 h-4 w-4 accent-[#CCFF00]" /><span className="flex-1 text-sm font-bold text-white">{action.text}<span className="mt-1 block text-xs font-medium text-slate-400">{action.completed ? 'Addressed in a later take' : [action.criterionLabel, action.sourceLabel].filter(Boolean).join(' · ')}</span></span>{action.completed ? <Check className="h-4 w-4 text-neon-lime" /> : null}</label>)}</div><button type="button" onClick={() => void saveActions(true)} disabled={!selected.length || savingActions} className="cta-primary mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-black disabled:opacity-50"><Sparkles className="h-4 w-4" />{savingActions ? 'Saving…' : 'Practice this feedback'}<ArrowRight className="h-4 w-4" /></button></div> : null}
    {status ? <p role="status" className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-slate-200">{status}</p> : null}
  </section>;
}
