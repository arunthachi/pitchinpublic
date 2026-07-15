'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, Bell, CalendarDays, CheckCircle2, Clock, Lock, Play, Sparkles, Target, Trophy, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPitchLength } from '@/lib/duration';

function daysUntil(value: string) {
  const target = new Date(`${value}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}

function formatFocus(value?: string | null) {
  if (!value) return 'Unspecified';
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDeadline(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildRecordHref(event: any) {
  const params = new URLSearchParams({
    record: '1',
    alpha: '1',
    preview: '1',
    pitchMax: String(event.pitch_length_seconds || 60),
    eventSlug: event.slug,
    eventName: event.name,
  });

  if (event.submission_deadline) params.set('eventDeadline', event.submission_deadline);
  if (event.focus) params.set('eventFocus', event.focus);

  return `/?${params.toString()}`;
}

const JOIN_PANEL_ID = 'event-join-panel';

function splitFocusSummary(value?: string | null) {
  return (value || '')
    .split(/[·,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: response.statusText || 'Unexpected response from the event room.',
    };
  }
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
  const submittedPitchId = searchParams.get('pitchId') || '';
  const submittedPitchPublicId = searchParams.get('pitchPublicId') || '';
  const submittedFromPublish = searchParams.get('submitted') === '1';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${slug}`);
      const data = await readJsonResponse(response);
      if (!response.ok || !data) {
        setEventState({ success: false, error: data?.error || 'Unable to load this pitch event.' });
        setSelectedPitchId('');
        return;
      }
      setEventState(data);
      setSelectedPitchId((current) => submittedPitchId || data.userSubmission?.pitch_id || current || '');
    } catch {
      setEventState({ success: false, error: 'Unable to load this pitch event.' });
      setSelectedPitchId('');
    } finally {
      setLoading(false);
    }
  }, [slug, submittedPitchId]);

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

  useEffect(() => {
    if (!submittedPitchPublicId || !pitches.length) return;
    const matchedPitch = pitches.find((pitch) => pitch.public_id === submittedPitchPublicId);
    if (matchedPitch?.id) setSelectedPitchId(matchedPitch.id);
  }, [pitches, submittedPitchPublicId]);

  const event = eventState?.event;
  const isJoined = Boolean(eventState?.participation);
  const selectedPitch = pitches.find((pitch) => pitch.id === selectedPitchId);
  const submittedPitch = pitches.find((pitch) => pitch.id === eventState?.userSubmission?.pitch_id);
  const isSubmissionClosed = Boolean(event?.submission_deadline && new Date(event.submission_deadline).getTime() < Date.now());
  const focusTags = useMemo(() => splitFocusSummary(event?.focus), [event?.focus]);
  const plan = useMemo(() => {
    if (!event) return [];
    const days = daysUntil(event.event_date);
    if (days > 45) return ['Record rough reps twice a week.', 'Get one Toast and one Roast per take.', 'Fix the audience sentence first.'];
    if (days > 14) return ['Record every other day.', 'Cut weak openings.', 'Make the ask specific enough to repeat.'];
    return ['Record under event timing.', 'Pick the cleanest final take.', 'Stop changing anything that feedback does not repeat.'];
  }, [event]);
  const recordHref = event ? buildRecordHref(event) : '/';

  useEffect(() => {
    if (!submittedFromPublish || (!submittedPitchId && !submittedPitchPublicId) || !isJoined) return;
    if (!message) {
      setMessage('Your new take is loaded. Submit it or mark it as your Best Take.');
    }
  }, [isJoined, message, submittedFromPublish, submittedPitchId, submittedPitchPublicId]);

  const join = async () => {
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/events/${slug}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode }),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Could not join this pitch room.');
      return;
    }
    setMessage('You joined the pitch room.');
    load();
  };

  const submitFinalTake = async () => {
    if (!selectedPitchId) return;
    if (isSubmissionClosed) {
      setMessage('The submission deadline has passed for this event.');
      return;
    }
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/events/${slug}/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pitchId: selectedPitchId }),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Could not submit final take.');
      return;
    }
    setMessage('Final take submitted.');
    load();
  };

  const markBestTake = async () => {
    if (!selectedPitchId) return;
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/pitches/${selectedPitchId}/best-take`, {
      method: 'POST',
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Could not mark this take as your Best Take.');
      return;
    }
    setMessage('Best Take saved for this pitch.');
    load();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Loading pitch room...</div>;
  }

  if (!eventState?.success || !event) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Pitch room not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="grid gap-6 lg:grid-cols-[1fr_0.88fr]">
          <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
            <div className="glass-pill mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-neon-lime">
              <Sparkles className="h-4 w-4" />
              Pitch room
            </div>
            <h1 className="font-heading text-5xl font-black leading-tight sm:text-6xl">{event.name}</h1>
            {event.description && <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{event.description}</p>}
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard icon={CalendarDays} label="Pitch day" value={new Date(`${event.event_date}T12:00:00`).toLocaleDateString()} />
              <InfoCard icon={Clock} label="Deadline" value={formatDeadline(event.submission_deadline)} />
              <InfoCard icon={Video} label="Pitch length" value={formatPitchLength(event.pitch_length_seconds)} />
              <InfoCard icon={Target} label="Goal" value={formatFocus(event.focus)} />
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Sprint focus</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusTags.map((focus) => (
                  <span key={focus} className="rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-1.5 text-xs font-bold text-neon-cyan">
                    {focus}
                  </span>
                ))}
                {!focusTags.length && <span className="text-sm text-slate-400">No focus chips set.</span>}
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-400">
              {daysUntil(event.event_date)} days until pitch day. Submit before the deadline, then use your Best Take for the room.
            </p>
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
            {isJoined ? (
              <Link href={recordHref} className="cta-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black">
                Record an eligible take
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <a href={`#${JOIN_PANEL_ID}`} className="cta-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black">
                Join to record
                <ArrowRight className="h-5 w-5" />
              </a>
            )}
            {eventState.announcements?.length ? (
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-neon-lime">
                  <Bell className="h-4 w-4" />
                  Founder nudge
                </div>
                <h3 className="font-heading text-xl font-bold">{eventState.announcements[0].title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{eventState.announcements[0].body}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Keep the next take concrete: customer first, one problem, one ask.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section id={JOIN_PANEL_ID} className="glass-card mt-6 rounded-[2rem] p-5 sm:p-6">
          {!user ? (
            <div className="text-center">
              <h2 className="font-heading text-3xl font-bold">Sign in to join this pitch room.</h2>
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
                  {event.visibility === 'private' ? 'Invite code required' : 'Invite code (optional)'}
                </span>
                <input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="input-dark"
                  placeholder={event.visibility === 'private' ? 'Enter invite code' : 'WESTPORT2026'}
                />
              </label>
              <button onClick={join} disabled={saving} className="cta-primary rounded-xl px-5 py-3 font-heading font-bold disabled:opacity-60">
                Join pitch room
              </button>
              <p className="sm:col-span-2 text-sm leading-6 text-slate-400">
                {event.visibility === 'private'
                  ? 'Private events need an invite code before you can join, record, or submit.'
                  : 'Use the invite code if you received one; otherwise this event can be joined with the shared link.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <div>
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Submission</p>
                    <p className="mt-1 font-heading text-xl font-black text-white">
                      {eventState.userSubmission ? 'Submitted' : 'Ready to submit'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {eventState.userSubmission ? 'You already have a pitch attached to this event.' : 'Pick your strongest take or record a new one.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Deadline</p>
                    <p className="mt-1 font-heading text-xl font-black text-white">
                      {formatDeadline(event.submission_deadline)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {isSubmissionClosed ? 'Submissions are closed.' : `${daysUntil(event.event_date)} days until pitch day.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Goal</p>
                    <p className="mt-1 font-heading text-xl font-black text-white">{formatFocus(event.focus)}</p>
                    <p className="mt-1 text-sm text-slate-400">Keep the pitch tight enough to fit the room and the deadline.</p>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap gap-3">
                  <Link href={recordHref} className="cta-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-heading font-black">
                    Record eligible take
                    <Video className="h-4 w-4" />
                  </Link>
                  {selectedPitch && (
                    <button
                      type="button"
                      onClick={markBestTake}
                      disabled={saving || Boolean(selectedPitch.is_best_take)}
                      className="btn-glass inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-heading font-bold disabled:opacity-60"
                    >
                      <Trophy className="h-4 w-4" />
                      {selectedPitch.is_best_take ? 'Best Take saved' : 'Mark Best Take'}
                    </button>
                  )}
                </div>

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
                        {pitch.is_best_take && <span className="absolute right-3 top-3 rounded-full bg-toast px-2 py-1 text-xs font-black text-slate-950">Best Take</span>}
                        {eventState.userSubmission?.pitch_id === pitch.id && <span className="absolute left-3 top-10 rounded-full bg-neon-cyan px-2 py-1 text-xs font-black text-slate-950">Submitted</span>}
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
                  {isSubmissionClosed
                    ? 'The deadline has passed, so submission changes are closed.'
                    : 'You can change your final take until the organizer locks submissions.'}
                </p>
                {selectedPitch && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Selected take</p>
                    <p className="mt-2 font-bold text-white">{selectedPitch.hook}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {selectedPitch.is_best_take ? 'This is your Best Take already.' : 'You can submit this pitch or mark it as your Best Take.'}
                    </p>
                  </div>
                )}
                {submittedPitch && (
                  <div className="mt-4 rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-sm font-bold text-white">{submittedPitch.hook}</p>
                  </div>
                )}
                <button
                  onClick={submitFinalTake}
                  disabled={!selectedPitchId || saving || isSubmissionClosed}
                  className="cta-primary mt-5 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : isSubmissionClosed ? 'Submissions closed' : eventState.userSubmission ? 'Update final take' : 'Submit final take'}
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
