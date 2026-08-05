'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, CalendarDays, Clock, Lock, LogOut, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPitchLength } from '@/lib/duration';
import { SignInModal } from '@/components/SignInModal';
import { ActionPageNav } from '@/components/ActionPageNav';
import { destination, eventDashboardDestination } from '@/lib/app-navigation';

interface PendingSubmission {
  id: string;
  publicId: string | null;
  hook: string;
}

const EVENT_SUBMISSION_RETRY_PREFIX = 'pitchinpublic:event-submission:';

function getEventSubmissionRetryKey(slug: string) {
  return `${EVENT_SUBMISSION_RETRY_PREFIX}${slug}`;
}

function formatDeadline(value?: string | null) {
  if (!value) return 'No deadline';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return 'No deadline';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deadlineHasPassed(value?: string | null) {
  if (!value) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999` : value;
  const deadline = new Date(normalized).getTime();
  return Number.isFinite(deadline) && deadline < Date.now();
}

function buildRecordHref(event: any) {
  const params = new URLSearchParams({
    record: '1',
    pitchMax: String(event.pitch_length_seconds || 60),
    eventSlug: event.slug,
    eventName: event.name,
  });
  if (event.submission_deadline) params.set('eventDeadline', event.submission_deadline);
  if (event.focus) params.set('eventFocus', event.focus);
  return `/?${params.toString()}`;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: response.statusText || 'Unexpected response from the event.' };
  }
}

export default function EventPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { user, loading: authLoading, signOut } = useAuth();
  const [eventState, setEventState] = useState<any>(null);
  const [pitches, setPitches] = useState<any[]>([]);
  const [pitchesLoading, setPitchesLoading] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [selectedPitchId, setSelectedPitchId] = useState('');
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<PendingSubmission | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const inviteCode = searchParams.get('invite') || searchParams.get('code') || '';
  const returnedPitchId = searchParams.get('pitchId') || '';
  const returnedPitchPublicId = searchParams.get('pitchPublicId') || '';
  const returnedFromLegacyPublish = searchParams.get('submitted') === '1';
  const inviteNextPath = inviteCode
    ? `/events/${slug}?invite=${encodeURIComponent(inviteCode)}`
    : `/events/${slug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : '';
      const response = await fetch(`/api/events/${slug}${query}`, { cache: 'no-store' });
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success) {
        setEventState({ success: false, error: data?.error || 'Unable to load this event.' });
        return;
      }
      setEventState(data);
      setSelectedPitchId((current) => returnedPitchId || data.userSubmission?.pitch_id || current);
    } catch {
      setEventState({ success: false, error: 'Unable to load this event.' });
    } finally {
      setLoading(false);
    }
  }, [inviteCode, returnedPitchId, slug]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  useEffect(() => {
    if (inviteCode) setAccessCode(inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(getEventSubmissionRetryKey(slug));
      if (stored) setPendingSubmission(JSON.parse(stored) as PendingSubmission);
    } catch {
      window.sessionStorage.removeItem(getEventSubmissionRetryKey(slug));
    }
  }, [slug]);

  useEffect(() => {
    const loadPitches = async () => {
      if (!user) {
        setPitches([]);
        setPitchesLoading(false);
        return;
      }
      setPitchesLoading(true);
      try {
        const response = await fetch(`/api/pitches?userId=${user.id}&limit=100`);
        if (!response.ok) return;
        const data = await response.json();
        setPitches(data.pitches || []);
      } finally {
        setPitchesLoading(false);
      }
    };
    loadPitches();
  }, [user]);

  useEffect(() => {
    if (!pitches.length) return;
    const returnedPitch = returnedPitchPublicId
      ? pitches.find((pitch) => pitch.public_id === returnedPitchPublicId)
      : null;
    setSelectedPitchId((current) => returnedPitch?.id || current || pitches[0].id);
  }, [pitches, returnedPitchPublicId]);

  const event = eventState?.event;
  const isJoined = Boolean(eventState?.participation);
  const isSubmissionClosed = deadlineHasPassed(event?.submission_deadline);
  const invite = eventState?.invite;
  const inviteEmailMismatch = Boolean(user && invite?.email && invite.matchesCurrentUser === false);
  const inviteUnavailable = Boolean(
    !isJoined && inviteCode && (!invite?.valid || ['expired', 'invalid', 'revoked', 'used'].includes(invite?.status)),
  );
  const hasDirectInvite = Boolean(inviteCode && !inviteUnavailable && !isJoined);
  const selectedPitch = pitches.find((pitch) => pitch.id === selectedPitchId);
  const submittedPitch = pitches.find((pitch) => pitch.id === eventState?.userSubmission?.pitch_id);
  const unresolvedPendingSubmission = pendingSubmission?.id === eventState?.userSubmission?.pitch_id
    ? null
    : pendingSubmission;
  const currentSubmittedPitch = submissionSuccess || (submittedPitch ? {
    id: submittedPitch.id,
    publicId: submittedPitch.public_id || null,
    hook: submittedPitch.hook,
  } : null);
  const recordHref = event ? buildRecordHref(event) : '/';

  useEffect(() => {
    if (!returnedFromLegacyPublish || (!returnedPitchId && !returnedPitchPublicId) || !isJoined || eventState?.userSubmission) return;
    setMessage('Your take is ready. Submit it to finish joining this event.');
  }, [eventState?.userSubmission, isJoined, returnedFromLegacyPublish, returnedPitchId, returnedPitchPublicId]);

  useEffect(() => {
    if (!pendingSubmission || pendingSubmission.id !== eventState?.userSubmission?.pitch_id) return;
    setSubmissionSuccess(pendingSubmission);
    setPendingSubmission(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(getEventSubmissionRetryKey(slug));
    }
  }, [eventState?.userSubmission?.pitch_id, pendingSubmission, slug]);

  const join = async () => {
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/events/${slug}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteCode ? { inviteCode } : { accessCode }),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || `Could not join ${event?.name || 'this event'}.`);
      return;
    }
    setMessage('Invitation accepted. Record or choose your take next.');
    load();
  };

  const switchAccount = async () => {
    await signOut();
    setMessage('');
    setShowSignIn(true);
  };

  const clearPendingSubmission = () => {
    setPendingSubmission(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(getEventSubmissionRetryKey(slug));
    }
  };

  const submitFinalTake = async (pending: PendingSubmission | null = null) => {
    const body = pending
      ? pending.publicId ? { pitchPublicId: pending.publicId } : { pitchId: pending.id }
      : selectedPitchId ? { pitchId: selectedPitchId } : null;
    if (!body) return;
    if (isSubmissionClosed) {
      setMessage('The submission deadline has passed for this event.');
      return;
    }

    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/events/${slug}/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Could not submit this take.');
      return;
    }

    const sourcePitch = pending || selectedPitch;
    const successPitch: PendingSubmission = {
      id: data.pitchId || sourcePitch?.id || '',
      publicId: data.publicId || sourcePitch?.publicId || sourcePitch?.public_id || null,
      hook: sourcePitch?.hook || 'Submitted pitch',
    };
    setSubmissionSuccess(successPitch);
    clearPendingSubmission();
    setMessage('Take submitted.');
    load();
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background text-white">
        <ActionPageNav links={[destination('feed')]} ariaLabel="Event navigation" />
        <div className="flex min-h-[70dvh] items-center justify-center">Loading event…</div>
      </div>
    );
  }

  if (!eventState?.success || !event) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center text-white">
        <p>{eventState?.error || 'Event not found.'}</p>
        <Link href="/" className="btn-glass rounded-xl px-5 py-3 font-bold">Back to feed</Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-white">
      <ActionPageNav
        ariaLabel="Event navigation"
        links={[
          ...(user ? [destination('pitchRooms', true)] : []),
          destination('feed'),
          ...(user && eventState.isTeamMember ? [eventDashboardDestination(slug)] : []),
        ]}
        account={user ? { email: user.email, profileHref: '/me', onSignOut: signOut } : undefined}
      />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        <section aria-labelledby="event-task-title" className="glass-panel rounded-[1.75rem] p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">
            {currentSubmittedPitch || eventState.userSubmission ? 'Submitted' : hasDirectInvite ? 'Your invitation' : isJoined ? 'Your next step' : 'Pitch event'}
          </p>
          <h1 id="event-task-title" className="mt-2 text-balance font-heading text-3xl font-black leading-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" />Submit by {formatDeadline(event.submission_deadline)}</span>
            <span>{formatPitchLength(event.pitch_length_seconds)} max</span>
          </p>

          <div className="mt-6">
            {inviteUnavailable ? (
              <InviteNotice
                title={invite?.status === 'expired' ? 'Invitation expired' : invite?.status === 'revoked' ? 'Invitation revoked' : 'Invitation unavailable'}
                copy="Ask the organizer to send a new invitation."
              />
            ) : authLoading ? (
              <p className="py-4 text-slate-400">Checking your account…</p>
            ) : hasDirectInvite && !user ? (
              <TaskCopy title="Sign in to accept" copy={invite?.email ? `Use ${invite.email} to keep this invitation connected to the right account.` : 'Sign in, then return here to accept.'}>
                <button type="button" onClick={() => setShowSignIn(true)} className="cta-primary mt-5 min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black">Sign in to accept</button>
              </TaskCopy>
            ) : hasDirectInvite && inviteEmailMismatch ? (
              <TaskCopy title="Use the invited account" copy={`This invitation is for ${invite.email}. You are signed in as ${user?.email}.`}>
                <button type="button" onClick={switchAccount} className="cta-primary mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black"><LogOut className="h-5 w-5" />Use invited account</button>
              </TaskCopy>
            ) : hasDirectInvite ? (
              <TaskCopy title="Accept your invitation" copy="Add this event to your pitch rooms and continue to your take.">
                <button type="button" onClick={join} disabled={saving} className="cta-primary mt-5 min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-60">{saving ? 'Accepting…' : 'Accept invitation'}</button>
              </TaskCopy>
            ) : !user ? (
              <TaskCopy title="Sign in to join" copy="Your event access and submission stay connected to your account.">
                <button type="button" onClick={() => setShowSignIn(true)} className="cta-primary mt-5 min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black">Sign in to continue</button>
              </TaskCopy>
            ) : inviteEmailMismatch ? (
              <TaskCopy title="Use the invited account" copy={`This invitation is for ${invite.email}.`}>
                <button type="button" onClick={switchAccount} className="btn-glass mt-5 min-h-14 w-full rounded-2xl px-5 py-4 font-bold">Switch account</button>
              </TaskCopy>
            ) : !isJoined ? (
              inviteCode ? (
                <TaskCopy title="Accept your invitation" copy="Join once, then this event stays in your pitch rooms.">
                  <button type="button" onClick={join} disabled={saving} className="cta-primary mt-5 min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-60">{saving ? 'Accepting…' : 'Accept invitation'}</button>
                </TaskCopy>
              ) : (
                <div>
                  <label htmlFor="access-code" className="text-sm font-bold text-white">{event.visibility === 'private' ? 'Invite code' : 'Invite code (optional)'}</label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input id="access-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} className="input-dark" placeholder="Enter code" />
                    <button type="button" onClick={join} disabled={saving} className="cta-primary min-h-14 rounded-2xl px-6 font-heading font-black disabled:opacity-60">{saving ? 'Joining…' : 'Join event'}</button>
                  </div>
                </div>
              )
            ) : unresolvedPendingSubmission ? (
              <TaskCopy title="Finish submitting your take" copy="Your video and pitch are saved. Retry only the event submission—no new upload needed.">
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-semibold text-white">{unresolvedPendingSubmission.hook}</div>
                <button type="button" onClick={() => submitFinalTake(unresolvedPendingSubmission)} disabled={saving || isSubmissionClosed} className="cta-primary mt-4 min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-50">{saving ? 'Retrying…' : 'Retry submission'}</button>
                <button type="button" onClick={clearPendingSubmission} className="mt-2 min-h-11 w-full text-sm font-bold text-slate-400 hover:text-white">Dismiss</button>
              </TaskCopy>
            ) : eventState.userSubmission && pitchesLoading ? (
              <TaskCopy title="Your take is submitted" copy="Loading your submitted pitch…" />
            ) : currentSubmittedPitch ? (
              <TaskCopy title="Your take is submitted" copy="The event team can now review it and give feedback.">
                <div className="mt-4 rounded-2xl border border-neon-lime/20 bg-neon-lime/10 p-4 text-sm font-semibold text-white">{currentSubmittedPitch.hook}</div>
                {currentSubmittedPitch.publicId ? (
                  <Link href={`/?mode=founder&pitch=${encodeURIComponent(currentSubmittedPitch.publicId)}`} className="cta-primary mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black">Watch your pitch<ArrowRight className="h-5 w-5" /></Link>
                ) : null}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {currentSubmittedPitch.publicId ? <Link href={`/pitch/${encodeURIComponent(currentSubmittedPitch.publicId)}`} className="btn-glass inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 font-bold">Open pitch</Link> : null}
                  {!isSubmissionClosed ? <Link href={recordHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 font-bold text-slate-300 hover:bg-white/[0.05]">Record another</Link> : null}
                </div>
              </TaskCopy>
            ) : pitchesLoading ? (
              <TaskCopy title="Checking your takes" copy="Finding your latest eligible pitch…" />
            ) : isSubmissionClosed ? (
              <TaskCopy title="Submissions are closed" copy={`The deadline was ${formatDeadline(event.submission_deadline)}.`} />
            ) : selectedPitch ? (
              <TaskCopy title="Submit your take" copy="Review the selected take, then send it to the event team.">
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="line-clamp-2 text-sm font-semibold leading-6 text-white">{selectedPitch.hook}</p>
                </div>
                <button type="button" onClick={() => submitFinalTake()} disabled={saving} className="cta-primary mt-4 min-h-14 w-full rounded-2xl px-5 py-4 font-heading font-black disabled:opacity-60">{saving ? 'Submitting…' : `Submit to ${event.name}`}</button>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Link href={recordHref} className="btn-glass inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 font-bold"><Video className="mr-2 h-4 w-4" />Record another</Link>
                  {pitches.length > 1 ? (
                    <details className="rounded-2xl border border-white/10">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center px-4 py-3 text-sm font-bold text-slate-300">Change take</summary>
                      <div className="space-y-2 border-t border-white/10 p-2">
                        {pitches.map((pitch) => (
                          <button key={pitch.id} type="button" onClick={() => setSelectedPitchId(pitch.id)} className={`min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${pitch.id === selectedPitchId ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-slate-300 hover:bg-white/[0.05]'}`}>{pitch.hook}</button>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </TaskCopy>
            ) : (
              <TaskCopy title="Record or upload your take" copy="Create the pitch you want the event team to review.">
                <Link href={recordHref} className="cta-primary mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black"><Video className="h-5 w-5" />Record or upload</Link>
              </TaskCopy>
            )}
          </div>

          {message ? <p className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-slate-200" role="status">{message}</p> : null}
        </section>

        <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-slate-300 focus-visible:ring-2 focus-visible:ring-neon-cyan">
            Event details <span aria-hidden="true">+</span>
          </summary>
          <div className="space-y-4 border-t border-white/10 p-4 text-sm leading-6 text-slate-300 sm:p-5">
            {event.description ? <p>{event.description}</p> : null}
            <dl className="grid gap-3 sm:grid-cols-2">
              <EventFact icon={CalendarDays} label="Pitch day" value={new Date(`${event.event_date}T12:00:00`).toLocaleDateString()} />
              <EventFact icon={Clock} label="Submission deadline" value={formatDeadline(event.submission_deadline)} />
              <EventFact icon={Video} label="Pitch length" value={formatPitchLength(event.pitch_length_seconds)} />
              {event.focus ? <EventFact label="Focus" value={String(event.focus).replace(/[-_]/g, ' ')} /> : null}
            </dl>
          </div>
        </details>
      </main>

      <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} initialEmail={invite?.email || ''} nextPath={inviteNextPath} />
    </div>
  );
}

function TaskCopy({ title, copy, children }: { title: string; copy: string; children?: ReactNode }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 max-w-xl text-base leading-7 text-slate-300">{copy}</p>
      {children}
    </div>
  );
}

function InviteNotice({ title, copy }: { title: string; copy: string }) {
  return (
    <div role="alert">
      <Lock className="h-7 w-7 text-neon-cyan" />
      <h2 className="mt-3 font-heading text-2xl font-black">{title}</h2>
      <p className="mt-2 text-slate-400">{copy}</p>
    </div>
  );
}

function EventFact({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}{label}
      </dt>
      <dd className="mt-1 capitalize text-white">{value}</dd>
    </div>
  );
}
