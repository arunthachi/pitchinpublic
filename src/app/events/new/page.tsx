'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';

const focusOptions = [
  'Clarity and ask',
  'ICP and audience',
  'Problem pain',
  'Storytelling',
  'Traction proof',
  'Investor Q&A',
  'Demo flow',
  'Competition prep',
];

function openNativeDatePicker(input: HTMLInputElement) {
  try {
    (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch {
    input.focus();
  }
}

export default function NewEventPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [roleLoading, setRoleLoading] = useState(true);
  const [canManageEvents, setCanManageEvents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: 'Local Shark Tank Pitch Event',
    description: 'Practice reps and final-take submissions for founders preparing for pitch day.',
    eventDate: '',
    submissionDeadline: '',
    pitchLengthSeconds: 60,
    focus: focusOptions[0],
    visibility: 'unlisted',
    accessCode: '',
  });
  const [customFocus, setCustomFocus] = useState('');
  const isCustomFocus = form.focus === 'custom';

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setRoleLoading(false);
      setCanManageEvents(false);
      return;
    }

    let cancelled = false;

    const checkOrganizerAccess = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('profile_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'organizer')
          .maybeSingle();

        if (!cancelled) {
          setCanManageEvents(Boolean(data));
        }
      } catch (error) {
        console.error('Could not check organizer access:', error);
        if (!cancelled) setCanManageEvents(false);
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    };

    checkOrganizerAccess();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          focus: isCustomFocus ? customFocus.trim() : form.focus,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not create pitch event.');
      }

      router.push(`/events/${data.event.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pitch event.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || roleLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-bold">Sign in to create a pitch event.</h1>
        <Link href="/?alpha=1&preview=1" className="cta-primary mt-6 rounded-xl px-5 py-3 font-heading font-bold">
          Go to app
        </Link>
      </div>
    );
  }

  if (!canManageEvents) {
    return (
      <div className="min-h-screen bg-background text-white">
        <header className="border-b border-white/10 bg-graphite-dark/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/?alpha=1&preview=1" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to practice
            </Link>
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-neon-cyan">Organizer invite</p>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl items-center px-4 py-10 sm:px-6">
          <section className="glass-panel w-full rounded-[2rem] p-6 text-center sm:p-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
              <CalendarDays className="h-8 w-8" />
            </div>
            <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-lime">
              For organizers
            </p>
            <h1 className="mx-auto mt-3 max-w-2xl font-heading text-4xl font-black leading-tight sm:text-5xl">
              Pitch events are for cohorts, competitions, and founder programs.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Founder accounts should focus on recording pitches, getting feedback, and picking a Best Take.
              Organizer tools are invite-only so the app stays simple for founders and event rooms stay controlled.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/?alpha=1&preview=1" className="btn-glass inline-flex items-center justify-center rounded-full px-6 py-4 font-heading font-bold">
                Continue practicing
              </Link>
              <LeadCaptureModal
                type="organizer"
                triggerLabel="Request organizer invite"
                source="events-new-gate"
                triggerClassName="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 font-heading font-black"
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="border-b border-white/10 bg-graphite-dark/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-neon-cyan">Room Control</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
        <section>
          <div className="glass-pill mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-neon-lime">
            <Sparkles className="h-4 w-4" />
            Pitch Event
          </div>
          <h1 className="font-heading text-5xl font-black leading-tight">Create the room founders practice toward.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Keep the event setup focused: deadline, pitch length, invite code, and the one thing founders should improve before pitch day.
          </p>
          <div className="glass-card mt-6 rounded-3xl p-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Event defaults</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/25 p-4">
                <CalendarDays className="mb-3 h-5 w-5 text-neon-cyan" />
                <p className="font-bold">30-90 day prep window</p>
              </div>
              <div className="rounded-2xl bg-black/25 p-4">
                <Lock className="mb-3 h-5 w-5 text-neon-lime" />
                <p className="font-bold">Invite link or code</p>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={submit} className="glass-panel rounded-[2rem] p-5 sm:p-6">
          <div className="space-y-4">
            <Field label="Event name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" required />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-dark min-h-24 resize-y" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pitch day">
                <input
                  type="date"
                  value={form.eventDate}
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="input-dark cursor-pointer"
                  required
                />
              </Field>
              <Field label="Submission deadline">
                <input
                  type="date"
                  value={form.submissionDeadline}
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })}
                  className="input-dark cursor-pointer"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pitch length">
                <select value={form.pitchLengthSeconds} onChange={(e) => setForm({ ...form, pitchLengthSeconds: Number(e.target.value) })} className="input-dark">
                  <option value={60}>1 minute</option>
                  <option value={90}>1.5 minutes</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                </select>
              </Field>
              <Field label="Visibility">
                <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="input-dark">
                  <option value="unlisted">Unlisted invite link</option>
                  <option value="public">Public</option>
                </select>
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="block text-sm font-bold text-slate-300">Practice focus</span>
                <span className="text-xs font-semibold text-slate-500">Pick one</span>
              </div>
              <div className="glass-card flex flex-wrap gap-2 rounded-3xl p-3">
                {focusOptions.map((option) => {
                  const selected = form.focus === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm({ ...form, focus: option })}
                      className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                        selected
                          ? 'border-neon-cyan bg-neon-cyan text-slate-950 shadow-lg shadow-neon-cyan/15'
                          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-neon-cyan/45 hover:text-white'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, focus: 'custom' })}
                  className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                    isCustomFocus
                      ? 'border-neon-lime bg-neon-lime text-slate-950 shadow-lg shadow-neon-lime/15'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-neon-lime/45 hover:text-white'
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustomFocus && (
                <input
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  className="input-dark mt-3"
                  placeholder="e.g. sharpen closing ask"
                  required
                />
              )}
            </div>
            <Field label="Optional access code">
              <input value={form.accessCode} onChange={(e) => setForm({ ...form, accessCode: e.target.value })} className="input-dark" placeholder="WESTPORT2026" />
            </Field>
          </div>

          {error && <p className="mt-4 rounded-xl border border-roast/25 bg-roast/10 px-4 py-3 text-sm font-semibold text-roast">{error}</p>}

          <button disabled={isSaving} className="cta-primary mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black transition hover:scale-[1.01] disabled:opacity-60">
            {isSaving ? 'Creating pitch event...' : 'Create pitch event'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}
