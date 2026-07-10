'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, Bell, CalendarDays, CheckCircle2, Clock, Lock, Play, Sparkles, Trophy, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPitchLength } from '@/lib/duration';

function daysUntil(value: string) {
  const target = new Date(`${value}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}

export default function EventPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [eventState, setEventState] = useState<any>(null);
  const [pitches, setPitches] = useState<any[]>([]);
  const [accessCode, setAccessCode] = useState('');
  const [selectedPitchId, setSelectedPitchId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inviteCode = searchParams.get('invite') || '';

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/events/${slug}`);
    const data = await response.json();
    setEventState(data);
    setSelectedPitchId(data.userSubmission?.pitch_id || '');
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (inviteCode) setAccessCode(inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    const loadPitches = async () => {
      if (!user) return;
      const response = await fetch(`/api/pitches?userId=${user.id}&limit=100`);
      if (!response.ok) return;
      const data = await response.json();
      setPitches(data.pitches || []);
    };
    loadPitches();
  }, [user]);

  const event = eventState?.event;
  const isJoined = Boolean(eventState?.participation);
  const submittedPitch = pitches.find((pitch) => pitch.id === selectedPitchId);
  const plan = useMemo(() => {
    if (!event) return [];
    const days = daysUntil(event.event_date);
    if (days > 45) return ['Record rough reps twice a week.', 'Get one Toast and one Roast per take.', 'Fix the audience sentence first.'];
    if (days > 14) return ['Record every other day.', 'Cut weak openings.', 'Make the ask specific enough to repeat.'];
    return ['Record under event timing.', 'Pick the cleanest final take.', 'Stop changing anything that feedback does not repeat.'];
  }, [event]);

  const join = async () => {
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/events/${slug}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Could not join this pitch event.');
      return;
    }
    setMessage('You joined the pitch event.');
    load();
  };

  const submitFinalTake = async () => {
    if (!selectedPitchId) return;
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/events/${slug}/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pitchId: selectedPitchId }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Could not submit final take.');
      return;
    }
    setMessage('Final take submitted.');
    load();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Loading pitch event...</div>;
  }

  if (!eventState?.success || !event) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Pitch event not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="grid gap-6 lg:grid-cols-[1fr_0.88fr]">
          <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
            <div className="glass-pill mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-neon-lime">
              <Sparkles className="h-4 w-4" />
              Pitch Event
            </div>
            <h1 className="font-heading text-5xl font-black leading-tight sm:text-6xl">{event.name}</h1>
            {event.description && <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{event.description}</p>}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <InfoCard icon={CalendarDays} label="Pitch day" value={new Date(`${event.event_date}T12:00:00`).toLocaleDateString()} />
              <InfoCard icon={Clock} label="Countdown" value={`${daysUntil(event.event_date)} days`} />
              <InfoCard icon={Video} label="Pitch length" value={formatPitchLength(event.pitch_length_seconds)} />
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Today&apos;s plan</p>
            <div className="mt-4 space-y-3">
              {plan.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-black/30 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" />
                  <p className="leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
            <Link href={`/?record=1&alpha=1&preview=1&pitchMax=${event.pitch_length_seconds}`} className="cta-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black">
              Record a practice rep
              <ArrowRight className="h-5 w-5" />
            </Link>
            {eventState.announcements?.length ? (
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-neon-lime">
                  <Bell className="h-4 w-4" />
                  Latest update
                </div>
                <h3 className="font-heading text-xl font-bold">{eventState.announcements[0].title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{eventState.announcements[0].body}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="glass-card mt-6 rounded-[2rem] p-5 sm:p-6">
          {!user ? (
            <div className="text-center">
              <h2 className="font-heading text-3xl font-bold">Sign in to join this pitch event.</h2>
              <p className="mt-2 text-slate-400">Use Google, record reps, and submit your final take.</p>
              <Link href={`/?alpha=1&preview=1&next=/events/${slug}`} className="cta-primary mt-5 inline-flex rounded-xl px-5 py-3 font-heading font-bold">
                Sign in
              </Link>
            </div>
          ) : !isJoined ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-300">
                  <Lock className="h-4 w-4" />
                  Invite code {event.visibility === 'private' ? '' : '(optional)'}
                </span>
                <input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="input-dark" placeholder="WESTPORT2026" />
              </label>
              <button onClick={join} disabled={saving} className="cta-primary rounded-xl px-5 py-3 font-heading font-bold disabled:opacity-60">
                Join pitch event
              </button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Final Take</p>
                <h2 className="mt-2 font-heading text-3xl font-bold">Choose the pitch you want organizers to review.</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pitches.map((pitch) => {
                    const selected = selectedPitchId === pitch.id;
                    return (
                      <button
                        key={pitch.id}
                        type="button"
                        onClick={() => setSelectedPitchId(pitch.id)}
                        className={`relative aspect-[9/16] overflow-hidden rounded-2xl border text-left transition ${
                          selected ? 'border-neon-lime shadow-[0_0_0_2px_rgba(183,255,42,0.35)]' : 'border-white/10 hover:border-neon-cyan/60'
                        }`}
                      >
                        {pitch.thumbnail_url ? (
                          <img src={pitch.thumbnail_url} alt={pitch.hook} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-950">
                            <Play className="h-8 w-8 text-white/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        {selected && <span className="absolute left-3 top-3 rounded-full bg-neon-lime px-2 py-1 text-xs font-black text-slate-950">Selected</span>}
                        <p className="absolute bottom-3 left-3 right-3 line-clamp-2 text-sm font-bold text-white">{pitch.hook}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card rounded-3xl p-5">
                <Trophy className="mb-4 h-8 w-8 text-neon-lime" />
                <h3 className="font-heading text-2xl font-bold">{eventState.userSubmission ? 'Submitted' : 'Ready to submit?'}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  You can change your final take until the organizer locks submissions.
                </p>
                {submittedPitch && (
                  <div className="mt-4 rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-sm font-bold text-white">{submittedPitch.hook}</p>
                  </div>
                )}
                <button
                  onClick={submitFinalTake}
                  disabled={!selectedPitchId || saving}
                  className="cta-primary mt-5 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : eventState.userSubmission ? 'Update final take' : 'Submit final take'}
                </button>
                {eventState.isTeamMember && (
                  <Link href={`/events/${slug}/dashboard`} className="mt-3 inline-flex w-full justify-center rounded-2xl border border-white/10 px-5 py-4 font-heading font-bold text-white">
                    Open team dashboard
                  </Link>
                )}
              </div>
            </div>
          )}

          {message && <p className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">{message}</p>}
        </section>
      </main>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <Icon className="mb-3 h-5 w-5 text-neon-cyan" />
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-heading text-xl font-black text-white">{value}</p>
    </div>
  );
}
