'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, KeyRound, Pencil, Save, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  EVENT_FOCUS_OPTIONS,
  EVENT_PITCH_LENGTH_OPTIONS,
  EVENT_VISIBILITY_OPTIONS,
  splitEventFocuses,
  type EventVisibility,
} from '@/lib/event-settings';

type AccessCodeAction = 'keep' | 'replace' | 'remove';

type EventEditDialogProps = {
  event: any;
  onSaved: (event: any) => void;
};

function initialForm(event: any) {
  return {
    name: event.name || '',
    description: event.description || '',
    eventDate: (event.event_date || '').slice(0, 10),
    submissionDeadline: (event.submission_deadline || '').slice(0, 10),
    pitchLengthSeconds: Number(event.pitch_length_seconds || 60),
    focus: splitEventFocuses(event.focus)[0] || EVENT_FOCUS_OPTIONS[0],
    visibility: (event.visibility || 'unlisted') as EventVisibility,
    accessCodeAction: 'keep' as AccessCodeAction,
    accessCode: '',
  };
}

export function EventEditDialog({ event, onSaved }: EventEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initialForm(event));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [issues, setIssues] = useState<Record<string, string[]>>({});
  const advancedTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(event));
    setShowAdvanced(false);
    setMessage('');
    setIssues({});
  }, [event, open]);

  const availableFocuses = useMemo(
    () => Array.from(new Set([...EVENT_FOCUS_OPTIONS, form.focus])),
    [form.focus]
  );

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setMessage('');
    setIssues({});

    if (form.submissionDeadline && form.submissionDeadline > form.eventDate) {
      setIssues({ submissionDeadline: ['Submission deadline must be on or before pitch day.'] });
      setMessage('Check the highlighted date before saving.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/events/${event.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          eventDate: form.eventDate,
          description: form.description,
          submissionDeadline: form.submissionDeadline,
          pitchLengthSeconds: form.pitchLengthSeconds,
          focuses: [form.focus],
          visibility: form.visibility,
          accessCodeAction: form.accessCodeAction,
          accessCode: form.accessCodeAction === 'replace' ? form.accessCode : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setIssues(data.issues || {});
        throw new Error(data.error || 'Could not save event changes.');
      }

      onSaved(data.event);
      setForm(initialForm(data.event));
      setMessage('Event settings saved. Organizer and founder views now use these details.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save event changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="btn-glass inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold text-white"
        >
          <Pencil className="h-4 w-4" />
          Edit event
        </button>
      </DialogTrigger>
      <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl gap-0 overflow-hidden rounded-2xl border-white/10 bg-slate-950 p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="border-b border-white/10 px-5 py-5 pr-14 text-left sm:px-6">
          <DialogTitle className="text-2xl font-black">Edit event</DialogTitle>
          <DialogDescription className="mt-2 leading-6">
            Update the room details founders use to prepare and submit.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submit}
          onKeyDownCapture={(keyEvent) => {
            if (keyEvent.key !== 'Escape' || !showAdvanced) return;
            keyEvent.stopPropagation();
            setShowAdvanced(false);
            window.requestAnimationFrame(() => advancedTriggerRef.current?.focus());
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <EditField label="Event name" error={issues.name?.[0]}>
              <input value={form.name} onChange={(input) => setForm({ ...form, name: input.target.value })} className="input-dark" required maxLength={120} />
            </EditField>
            <EditField label="Pitch day" error={issues.eventDate?.[0]}>
              <input type="date" value={form.eventDate} onChange={(input) => setForm({ ...form, eventDate: input.target.value })} className="input-dark" required />
            </EditField>

            <button
              ref={advancedTriggerRef}
              type="button"
              aria-expanded={showAdvanced}
              aria-controls="edit-event-advanced-settings"
              onClick={() => setShowAdvanced((current) => !current)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 text-left text-sm font-bold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              Advanced settings
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced ? (
              <div id="edit-event-advanced-settings" className="space-y-4 border-l border-white/10 pl-4">
                <EditField label="Description" error={issues.description?.[0]}>
                  <textarea value={form.description} onChange={(input) => setForm({ ...form, description: input.target.value })} className="input-dark min-h-20 resize-y" maxLength={1000} />
                </EditField>
                <EditField label="Submission deadline" error={issues.submissionDeadline?.[0]}>
                  <input type="date" value={form.submissionDeadline} max={form.eventDate} onChange={(input) => setForm({ ...form, submissionDeadline: input.target.value })} className="input-dark" />
                </EditField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditField label="Pitch length" error={issues.pitchLengthSeconds?.[0]}>
                    <select value={form.pitchLengthSeconds} onChange={(input) => setForm({ ...form, pitchLengthSeconds: Number(input.target.value) })} className="input-dark">
                      {EVENT_PITCH_LENGTH_OPTIONS.map((option) => <option key={option.seconds} value={option.seconds}>{option.label}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Practice focus" error={issues.focuses?.[0]}>
                    <select value={form.focus} onChange={(input) => setForm({ ...form, focus: input.target.value })} className="input-dark">
                      {availableFocuses.map((focus) => <option key={focus} value={focus}>{focus}</option>)}
                    </select>
                  </EditField>
                </div>
                <EditField label="Founder access" error={issues.visibility?.[0]}>
                  <select value={form.visibility} onChange={(input) => setForm({ ...form, visibility: input.target.value as EventVisibility })} className="input-dark">
                    {Object.entries(EVENT_VISIBILITY_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                  </select>
                  <span className="mt-1.5 block text-xs leading-5 text-slate-500">{EVENT_VISIBILITY_OPTIONS[form.visibility].helper}</span>
                </EditField>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" />
                    <div>
                      <p className="font-bold text-white">Access code</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{event.hasAccessCode ? 'A code is set.' : 'No code is set.'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Access code action">
                    {(['keep', 'replace', 'remove'] as const).map((action) => (
                      <button key={action} type="button" aria-pressed={form.accessCodeAction === action} disabled={action === 'remove' && !event.hasAccessCode} onClick={() => setForm({ ...form, accessCodeAction: action, accessCode: '' })} className={`min-h-11 rounded-xl border px-2 text-sm font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:opacity-40 ${form.accessCodeAction === action ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                        {action}
                      </button>
                    ))}
                  </div>
                  {form.accessCodeAction === 'replace' ? (
                    <EditField label="New access code" error={issues.accessCode?.[0]} className="mt-4">
                      <input value={form.accessCode} onChange={(input) => setForm({ ...form, accessCode: input.target.value })} className="input-dark" minLength={4} maxLength={32} required autoComplete="off" />
                    </EditField>
                  ) : null}
                  {form.accessCodeAction === 'remove' ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-300"><Trash2 className="h-4 w-4" /> The current code will be removed when you save.</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 bg-slate-950 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
            <div aria-live="polite" className="min-h-6 text-sm font-semibold">
              {message ? <p className={Object.keys(issues).length ? 'text-roast' : 'text-neon-lime'}>{message}</p> : null}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="cta-primary mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-heading font-black disabled:cursor-wait disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving changes...' : 'Save event changes'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditField({
  label,
  error,
  className = '',
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm font-semibold text-roast">{error}</span> : null}
    </label>
  );
}
