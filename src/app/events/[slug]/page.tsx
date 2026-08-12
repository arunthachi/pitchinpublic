'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, CalendarDays, Clock, Lock, LogOut, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { countEventFeedback, groupEventTakeFeedback } from '@/lib/event-feedback';
import { formatPitchLength } from '@/lib/duration';
import { SignInModal } from '@/components/SignInModal';
import { ActionPageNav } from '@/components/ActionPageNav';
import AppTabBar from '@/components/AppTabBar';
import { destination, eventDashboardDestination } from '@/lib/app-navigation';
import { getEventSubmissionRetryKey } from '@/lib/idempotency';
import { BUSINESS_STAGE_OPTIONS, EventPitchGuidance, INDUSTRY_OPTIONS, type GuidanceAction, type PitchBriefGroup, type PitchGuidelines } from '@/components/pitch-guidance/EventPitchGuidance';
import { eligibleEventSubmissionPitches } from '@/lib/pitch-guidance';

interface PendingSubmission {
  id: string;
  publicId: string | null;
  hook: string;
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

function buildRecordHref(event: any, guidelines?: PitchGuidelines | null) {
  const params = new URLSearchParams({
    record: '1',
    pitchMax: String(event.pitch_length_seconds || 60),
    eventSlug: event.slug,
    eventName: event.name,
  });
  if (event.submission_deadline) params.set('eventDeadline', event.submission_deadline);
  if (event.focus) params.set('eventFocus', event.focus);
  if (guidelines?.id) params.set('guidelineVersionId', guidelines.id);
  if (guidelines?.version) params.set('guidelineVersion', String(guidelines.version));
  return `/?${params.toString()}`;
}

function normalizeGuidancePayload(data: any): { guidelines: PitchGuidelines | null; groups: PitchBriefGroup[]; actions: GuidanceAction[]; complete: boolean } {
  const source = data?.brief || data || {};
  const rawGuidelines = data?.guidelines || source.guidelines || data?.rubric || source.rubric || null;
  const guidelineSource = Array.isArray(rawGuidelines) ? rawGuidelines[0] || null : rawGuidelines;
  const criteria = (guidelineSource?.criteria || guidelineSource?.items || []).map((criterion: any, index: number) => ({
    id: String(criterion.id || criterion.key || index),
    label: String(criterion.label || criterion.title || criterion.name || 'Pitch criterion'),
    description: criterion.description || criterion.guidance || null,
  }));
  const guidelines = guidelineSource ? {
    id: guidelineSource.id || guidelineSource.guideline_version_id || null,
    title: guidelineSource.title || guidelineSource.name || null,
    introduction: guidelineSource.introduction || guidelineSource.description || guidelineSource.instructions || null,
    version: guidelineSource.version || guidelineSource.version_number || null,
    updatedAt: guidelineSource.created_at || guidelineSource.updated_at || null,
    criteria,
  } : null;
  const answers = source.answers || source.values || source || {};
  const defaultGroups = guidelineSource ? [
    { id: 'business', label: 'Business', fields: [
      { key: 'tagline', label: 'Tagline', required: true, maxLength: 60 },
      { key: 'businessStage', sourceKey: 'business_stage', label: 'Business stage', required: false, kind: 'select', options: BUSINESS_STAGE_OPTIONS },
      { key: 'industry', label: 'Industry', required: false, kind: 'combobox', options: INDUSTRY_OPTIONS },
    ] },
    { id: 'story', label: 'Pitch story', fields: [
      { key: 'businessDescription', sourceKey: 'business_description', label: 'Business description', required: true, kind: 'textarea', maxLength: 1800 },
      { key: 'problem', label: 'Problem it solves', required: true, kind: 'textarea', maxLength: 1200 },
      { key: 'ask', label: 'What is your ask?', required: true, kind: 'textarea', maxLength: 600 },
    ] },
  ] : [];
  const rawGroups = source.groups || data?.fieldsByGroup || defaultGroups;
  const groups: PitchBriefGroup[] = Array.isArray(rawGroups) ? rawGroups.map((group: any, groupIndex: number) => ({
    id: String(group.id || group.key || groupIndex),
    label: String(group.label || group.title || 'Pitch details'),
    description: group.description,
    fields: (group.fields || []).map((field: any, fieldIndex: number) => ({
      key: String(field.key || field.id || `${groupIndex}-${fieldIndex}`),
      label: String(field.label || field.title || field.key || 'Answer'),
      value: String(field.value ?? answers[field.key || field.id] ?? answers[field.sourceKey] ?? ''),
      required: Boolean(field.required),
      kind: field.kind || field.type || 'text',
      maxLength: field.maxLength || field.max_length || null,
      options: field.options,
    })),
  })) : [];
  const actions = (data?.guidanceActions || data?.guidance_actions || source.guidanceActions || []).map((action: any) => ({
    id: String(action.id),
    text: String(action.text || action.nextStep || action.next_step || action.action || ''),
    criterionLabel: action.criterionLabel || action.criterion_label || action.criterion?.label || null,
    selected: Boolean(action.selected || action.status === 'selected'),
    completed: Boolean(action.completed || action.status === 'completed'),
    sourceLabel: action.sourceLabel || action.source_label || action.feedback?.sourceLabel || null,
  })).filter((action: GuidanceAction) => action.id && action.text);
  const missingRequired = groups.flatMap((group) => group.fields).filter((field) => field.required && !field.value.trim());
  return { guidelines, groups, actions, complete: source.complete ?? source.isComplete ?? missingRequired.length === 0 };
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
  const [guidanceState, setGuidanceState] = useState(() => normalizeGuidancePayload({}));

  const inviteCode = searchParams.get('invite') || searchParams.get('code') || '';
  const returnedPitchId = searchParams.get('pitchId') || '';
  const returnedPitchPublicId = searchParams.get('pitchPublicId') || '';
  const returnedFromLegacyPublish = searchParams.get('submitted') === '1';
  const inviteNextPath = inviteCode
    ? `/events/${slug}?invite=${encodeURIComponent(inviteCode)}`
    : `/events/${slug}`;
  const event = eventState?.event;
  const isJoined = Boolean(eventState?.participation);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const query = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : '';
      const response = await fetch(`/api/events/${slug}${query}`, { cache: 'no-store', signal });
      const data = await readJsonResponse(response);
      if (signal?.aborted) return;
      if (!response.ok || !data?.success) {
        setEventState({ success: false, error: data?.error || 'Unable to load this event.' });
        return;
      }
      setEventState(data);
      setSelectedPitchId((current) => returnedPitchId || data.userSubmission?.pitch_id || current);
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      setEventState({ success: false, error: 'Unable to load this event.' });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [inviteCode, returnedPitchId, slug]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, user?.id]);

  useEffect(() => {
    if (inviteCode) setAccessCode(inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user?.id) {
      setPendingSubmission(null);
      return;
    }
    const retryKey = getEventSubmissionRetryKey(slug, user.id);
    try {
      const stored = window.sessionStorage.getItem(retryKey);
      setPendingSubmission(stored ? JSON.parse(stored) as PendingSubmission : null);
    } catch {
      window.sessionStorage.removeItem(retryKey);
      setPendingSubmission(null);
    }
  }, [slug, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const userId = user?.id;
    const loadPitches = async () => {
      if (!userId) {
        setPitches([]);
        setPitchesLoading(false);
        return;
      }
      setPitchesLoading(true);
      try {
        const response = await fetch(`/api/pitches?userId=${userId}&limit=100`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled) setPitches(data.pitches || []);
      } finally {
        if (!cancelled) setPitchesLoading(false);
      }
    };
    loadPitches();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const loadGuidance = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;
    try {
      const [guidelinesResponse, briefResponse] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(slug)}/guidelines`, { cache: 'no-store', signal }),
        fetch(`/api/events/${encodeURIComponent(slug)}/founder-brief`, { cache: 'no-store', signal }),
      ]);
      if (!guidelinesResponse.ok) return;
      const [guidelinesData, briefData] = await Promise.all([
        readJsonResponse(guidelinesResponse),
        briefResponse.ok ? readJsonResponse(briefResponse) : Promise.resolve({}),
      ]);
      if (!signal?.aborted) setGuidanceState(normalizeGuidancePayload({ guidelines: guidelinesData.guidelines, brief: briefData.brief }));
    } catch (error) {
      if (!(signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))) console.error('Could not load event pitch guidance:', error);
    }
  }, [slug, user?.id]);

  useEffect(() => {
    if (!isJoined) return;
    const controller = new AbortController();
    void loadGuidance(controller.signal);
    return () => controller.abort();
  }, [isJoined, loadGuidance]);

  useEffect(() => {
    if (!pitches.length) return;
    const returnedPitch = returnedPitchPublicId
      ? pitches.find((pitch) => pitch.public_id === returnedPitchPublicId)
      : null;
    const eligible = eligibleEventSubmissionPitches(
      pitches,
      event?.id ? { id: event.id, guidance_mode: event.guidance_mode } : null,
    );
    if (!eligible.length) return;
    const eligibleReturnedPitch = returnedPitch && eligible.some((pitch) => pitch.id === returnedPitch.id) ? returnedPitch : null;
    setSelectedPitchId((current) => eligibleReturnedPitch?.id || (eligible.some((pitch) => pitch.id === current) ? current : eligible[0].id));
  }, [event?.guidance_mode, event?.id, pitches, returnedPitchPublicId]);

  const isSubmissionClosed = deadlineHasPassed(event?.submission_deadline);
  const invite = eventState?.invite;
  const inviteEmailMismatch = Boolean(user && invite?.email && invite.matchesCurrentUser === false);
  const inviteUnavailable = Boolean(
    !isJoined && inviteCode && (!invite?.valid || ['expired', 'invalid', 'revoked', 'used'].includes(invite?.status)),
  );
  const hasDirectInvite = Boolean(inviteCode && !inviteUnavailable && !isJoined);
  const submissionPitches = eligibleEventSubmissionPitches(
    pitches,
    event?.id ? { id: event.id, guidance_mode: event.guidance_mode } : null,
  );
  const selectedPitch = submissionPitches.find((pitch) => pitch.id === selectedPitchId);
  const submittedPitch = pitches.find((pitch) => pitch.id === eventState?.userSubmission?.pitch_id);
  const unresolvedPendingSubmission = pendingSubmission?.id === eventState?.userSubmission?.pitch_id
    ? null
    : pendingSubmission;
  const currentSubmittedPitch = submissionSuccess || (submittedPitch ? {
    id: submittedPitch.id,
    publicId: submittedPitch.public_id || null,
    hook: submittedPitch.hook,
  } : null);
  const recordHref = event ? buildRecordHref(event, guidanceState.guidelines) : '/';
  const recordingAvailable = Boolean(guidanceState.guidelines);
  const eventTakes = groupEventTakeFeedback(pitches, {
    eventId: event?.id || eventState?.participation?.event_id || null,
    viewerId: user?.id || null,
    submittedPitchId: eventState?.userSubmission?.pitch_id || null,
  });
  const eventFeedbackCount = countEventFeedback(eventTakes);
  const structuredFeedbackById = new Map<string, any>(pitches.flatMap((pitch) => Array.isArray(pitch.feedback) ? pitch.feedback : []).map((entry: any) => [String(entry.id), entry]));
  const suggestedActions = eventTakes.reduce<GuidanceAction[]>((actions, take) => {
    take.feedback.forEach((entry) => {
      const structured = structuredFeedbackById.get(entry.id);
      if (!structured?.next_step) return;
      actions.push({
        id: entry.id,
        text: String(structured.next_step),
        criterionLabel: structured.criterion_label || structured.criterion_key || null,
        selected: Boolean(structured.guidance_action?.status === 'selected'),
        completed: Boolean(structured.guidance_action?.status === 'addressed'),
        sourceLabel: entry.roleLabel,
      });
    });
    return actions;
  }, []);

  useEffect(() => {
    if (!returnedFromLegacyPublish || (!returnedPitchId && !returnedPitchPublicId) || !isJoined || eventState?.userSubmission) return;
    setMessage('Your take is ready. Submit it to finish joining this event.');
  }, [eventState?.userSubmission, isJoined, returnedFromLegacyPublish, returnedPitchId, returnedPitchPublicId]);

  useEffect(() => {
    if (!pendingSubmission || pendingSubmission.id !== eventState?.userSubmission?.pitch_id) return;
    setSubmissionSuccess(pendingSubmission);
    setPendingSubmission(null);
    if (typeof window !== 'undefined') {
      if (user?.id) window.sessionStorage.removeItem(getEventSubmissionRetryKey(slug, user.id));
    }
  }, [eventState?.userSubmission?.pitch_id, pendingSubmission, slug, user?.id]);

  const join = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/events/${slug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteCode ? { inviteCode } : { accessCode }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Could not join ${event?.name || 'this event'}.`);
      }
      setMessage('Invitation accepted. Record or choose your take next.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not join ${event?.name || 'this event'}.`);
    } finally {
      setSaving(false);
    }
  };

  const switchAccount = async () => {
    clearPendingSubmission();
    await signOut();
    setMessage('');
    setShowSignIn(true);
  };

  const clearPendingSubmission = () => {
    setPendingSubmission(null);
    if (typeof window !== 'undefined') {
      if (user?.id) window.sessionStorage.removeItem(getEventSubmissionRetryKey(slug, user.id));
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
    if (guidanceState.groups.length && !guidanceState.complete) {
      setMessage('Complete the required pitch brief items below before submitting your final event take. You can still record practice takes.');
      document.getElementById('your-pitch-plan-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/events/${slug}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not submit this take.');
      }

      const sourcePitch = pending || selectedPitch;
      const successPitch: PendingSubmission = {
        id: data.pitchId || sourcePitch?.id || '',
        publicId: data.publicId || sourcePitch?.publicId || sourcePitch?.public_id || null,
        hook: sourcePitch?.hook || 'Submitted pitch',
      };
      setSubmissionSuccess(successPitch);
      clearPendingSubmission();
      setMessage(
        data.visibilityChanged
          ? 'Take submitted. It is now private to this event — you can share it back to the public feed anytime from your pitch page.'
          : 'Take submitted.'
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit this take.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background text-white">
        <ActionPageNav links={[destination('feed')]} ariaLabel="Event navigation" />
        <AppTabBar active="events" />
        <div className="flex min-h-[70dvh] items-center justify-center">Loading event…</div>
      </div>
    );
  }

  if (!eventState?.success || !event) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center text-white">
        <p>{eventState?.error || 'Event not found.'}</p>
        <Link href="/" className="btn-glass rounded-xl px-5 py-3 font-bold">Back to feed</Link>
        {user ? <AppTabBar active="events" /> : null}
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
      {user ? <AppTabBar active="events" /> : null}
      <main className={`mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6 ${user ? 'pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-10' : 'pb-10'}`}>
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
              <TaskCopy title="Accept your invitation" copy="Add this event to your events and continue to your take.">
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
                <TaskCopy title="Accept your invitation" copy="Join once, then this event stays in your events.">
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
                  {!isSubmissionClosed && recordingAvailable ? <Link href={recordHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 font-bold text-slate-300 hover:bg-white/[0.05]">Record another</Link> : null}
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
                  {recordingAvailable ? <Link href={recordHref} className="btn-glass inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 font-bold"><Video className="mr-2 h-4 w-4" />Record another</Link> : <span className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 px-4 text-sm text-slate-500">Standard in preparation</span>}
                  {submissionPitches.length > 1 ? (
                    <details className="rounded-2xl border border-white/10">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center px-4 py-3 text-sm font-bold text-slate-300">Change take</summary>
                      <div className="space-y-2 border-t border-white/10 p-2">
                        {submissionPitches.map((pitch) => (
                          <button key={pitch.id} type="button" onClick={() => setSelectedPitchId(pitch.id)} className={`min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${pitch.id === selectedPitchId ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-slate-300 hover:bg-white/[0.05]'}`}>{pitch.hook}</button>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </TaskCopy>
            ) : (
              <TaskCopy title={recordingAvailable ? 'Record or upload your take' : 'Prepare for the pitch standard'} copy={recordingAvailable ? 'Use the pitch plan below to create the take you want the event team to review.' : 'The organizer is preparing this event’s pitch plan. Recording opens after it is published.'}>
                {recordingAvailable ? <Link href={recordHref} className="cta-primary mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-heading font-black"><Video className="h-5 w-5" />Record or upload</Link> : null}
              </TaskCopy>
            )}
          </div>

          {message ? <p className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-slate-200" role="status">{message}</p> : null}

          {isJoined ? (
            <Link
              href={`/?eventFeed=${encodeURIComponent(slug)}`}
              className="btn-glass mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold"
            >
              <Video className="h-4 w-4" />
              Watch cohort takes
            </Link>
          ) : null}
        </section>

        {isJoined ? (
          <EventPitchGuidance
            slug={slug}
            guidelines={guidanceState.guidelines}
            groups={guidanceState.groups}
            actions={guidanceState.actions.length ? guidanceState.actions : suggestedActions}
            recordHref={recordHref}
            onSaved={() => void loadGuidance()}
          />
        ) : null}

        {isJoined ? (
          <section aria-labelledby="event-feedback-title" className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="event-feedback-title" className="font-heading text-2xl font-black text-white">Your feedback</h2>
              <p className="text-sm text-slate-400">
                {eventFeedbackCount
                  ? `${eventFeedbackCount} response${eventFeedbackCount === 1 ? '' : 's'} across ${eventTakes.length} take${eventTakes.length === 1 ? '' : 's'}`
                  : 'From your event team and cohort'}
              </p>
            </div>

            {eventTakes.length ? (
              <div className="mt-4 space-y-3">
                {eventTakes.map((take) => (
                  <article key={take.pitchId} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-neon-cyan">{take.takeLabel}</span>
                      {take.isSubmitted ? (
                        <span className="rounded-full bg-neon-lime px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950">Submitted</span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{take.hook}</span>
                    </div>
                    {take.feedback.length ? (
                      <ul className="mt-3 space-y-2">
                        {take.feedback.map((entry) => {
                          const structured = structuredFeedbackById.get(entry.id);
                          return <li key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                              <span className={entry.type === 'roast' ? 'text-roast' : 'text-neon-lime'}>{entry.type === 'roast' ? 'Roast' : 'Toast'}</span>
                              <span className="text-slate-500">{entry.roleLabel}</span>
                            </div>
                            {structured?.observation || entry.content ? <p className="mt-2 text-sm leading-6 text-slate-200"><span className="font-bold text-white">What I noticed: </span>{structured?.observation || entry.content}</p> : null}
                            {structured?.next_step ? <p className="mt-2 rounded-lg bg-neon-cyan/[0.07] px-3 py-2 text-sm leading-6 text-slate-200"><span className="font-bold text-neon-cyan">Try this next: </span>{structured.next_step}</p> : null}
                            {structured?.criterion_label || structured?.criterion_key ? <p className="mt-2 text-xs font-bold text-slate-500">Criterion: {structured.criterion_label || structured.criterion_key}</p> : null}
                          </li>
                        })}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No feedback on this take yet.</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-400">No takes for this event yet — record one and reviews will land here.</p>
            )}
          </section>
        ) : null}

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
