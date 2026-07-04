'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function NewEventPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: 'Local Shark Tank Pitch Sprint',
    description: 'Practice reps and final-take submissions for founders preparing for pitch day.',
    eventDate: '',
    submissionDeadline: '',
    pitchLengthSeconds: 60,
    focus: 'clarity and ask',
    visibility: 'unlisted',
    accessCode: '',
  });

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
          submissionDeadline: form.submissionDeadline ? new Date(form.submissionDeadline).toISOString() : '',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not create pitch sprint.');
      }

      router.push(`/events/${data.event.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pitch sprint.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-bold">Sign in to create a pitch sprint.</h1>
        <Link href="/?alpha=1&preview=1" className="mt-6 rounded-xl bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
          Go to app
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
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
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon-lime/25 bg-neon-lime/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-neon-lime">
            <Sparkles className="h-4 w-4" />
            Pitch Sprint
          </div>
          <h1 className="font-heading text-5xl font-black leading-tight">Create the room founders practice toward.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Keep the event setup focused: deadline, pitch length, invite code, and the one thing founders should improve before pitch day.
          </p>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Pilot defaults</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/35 p-4">
                <CalendarDays className="mb-3 h-5 w-5 text-neon-cyan" />
                <p className="font-bold">30-90 day sprint</p>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <Lock className="mb-3 h-5 w-5 text-neon-lime" />
                <p className="font-bold">Invite link or code</p>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-6">
          <div className="space-y-4">
            <Field label="Event name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" required />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-dark min-h-24 resize-y" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pitch day">
                <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="input-dark" required />
              </Field>
              <Field label="Submission deadline">
                <input type="datetime-local" value={form.submissionDeadline} onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })} className="input-dark" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pitch length">
                <select value={form.pitchLengthSeconds} onChange={(e) => setForm({ ...form, pitchLengthSeconds: Number(e.target.value) })} className="input-dark">
                  <option value={60}>60 seconds</option>
                  <option value={90}>90 seconds</option>
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
            <Field label="Sprint focus">
              <input value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} className="input-dark" />
            </Field>
            <Field label="Optional access code">
              <input value={form.accessCode} onChange={(e) => setForm({ ...form, accessCode: e.target.value })} className="input-dark" placeholder="WESTPORT2026" />
            </Field>
          </div>

          {error && <p className="mt-4 rounded-xl border border-roast/25 bg-roast/10 px-4 py-3 text-sm font-semibold text-roast">{error}</p>}

          <button disabled={isSaving} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-lime px-5 py-4 font-heading font-black text-slate-950 transition hover:scale-[1.01] disabled:opacity-60">
            {isSaving ? 'Creating sprint...' : 'Create pitch sprint'}
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
