'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  Copy,
  ExternalLink,
  LogOut,
  ListChecks,
  Mail,
  MessageSquareText,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Trophy,
  UserCircle2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPitchLength } from '@/lib/duration';
import { readableEmailError } from '@/lib/email-errors';
import { inviteEmailStatusLabel, inviteEmailStatusTone } from '@/lib/email';
import { announcementEmailStatusLabel, announcementEmailStatusTone } from '@/lib/event-announcements';
import { getTakeLabelFromFields } from '@/lib/pitch-copy';
import { getPracticePrompt } from '@/lib/practice';
import { pitchPath } from '@/lib/public-routes';
import { normalizeEventReviewCoverage } from '@/lib/review-marketplace';
import type { EventReviewCoverage } from '@/types';

const TEAM_ROLES = ['organizer', 'admin', 'coach', 'mentor', 'judge'];
const INVITE_ROLE_GROUPS = [
  {
    label: 'Founders',
    helper: 'Invite the people who will join the room and submit their best take.',
    roles: ['founder'],
  },
  {
    label: 'Team',
    helper: 'Invite organizers, admins, coaches, mentors, and judges who can help review the room.',
    roles: ['organizer', 'admin', 'coach', 'mentor', 'judge'],
  },
] as const;
const TABS = ['overview', 'founders', 'submissions', 'team', 'announcements'] as const;

type Tab = (typeof TABS)[number];

type FounderSummary = {
  participant: any;
  pitches: any[];
  latestPitch: any | null;
  submittedPitch: any | null;
  feedbackCount: number;
  joinedAt?: string;
  recorded: boolean;
  submitted: boolean;
  hasBestTake: boolean;
  readiness: number;
  repeatedSignals: Array<{ label: string; count: number }>;
  status: string;
};

function parseFeedbackContent(item: any) {
  try {
    return item?.content ? JSON.parse(item.content) : {};
  } catch {
    return { notes: item?.content || '' };
  }
}

function getFeedbackSignals(item: any) {
  const parsed = parseFeedbackContent(item);
  const signals = Array.isArray(parsed.signals) && parsed.signals.length ? parsed.signals : parsed.signal ? [parsed.signal] : [];
  return signals.map((signal: unknown) => String(signal).trim()).filter(Boolean);
}

function readinessFromFeedback(feedback: any[]) {
  if (!feedback.length) return 0;
  const values = feedback.map((item) => Number(parseFeedbackContent(item).readiness || 2));
  return Math.round((values.reduce((sum: number, value: number) => sum + value, 0) / values.length) * 10) / 10;
}

function readinessLabel(value: number) {
  if (!value) return 'Needs signal';
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

function summarizeSignals(feedbackItems: any[]) {
  const counts = new Map<string, number>();
  feedbackItems.forEach((item) => {
    getFeedbackSignals(item).forEach((signal: string) => {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildFounderSummary(participant: any, pitches: any[], submissions: any[]): FounderSummary {
  const founderPitches = pitches.filter((pitch) => pitch.user_id === participant.user_id);
  const latestPitch = founderPitches[0] || null;
  const submittedPitch = submissions.find((submission) => submission.user_id === participant.user_id) || null;
  const pitchWithFeedback = founderPitches.find((pitch) => (pitch.feedback || []).length) || submittedPitch?.pitch || latestPitch;
  const feedbackItems = founderPitches.flatMap((pitch) => pitch.feedback || []);
  const readiness = pitchWithFeedback ? readinessFromFeedback(pitchWithFeedback.feedback || []) : 0;
  const repeatedSignals = summarizeSignals(feedbackItems)
    .filter((signal) => signal.count > 1)
    .slice(0, 3);

  return {
    participant,
    pitches: founderPitches,
    latestPitch,
    submittedPitch,
    feedbackCount: feedbackItems.length,
    joinedAt: participant.joined_at,
    recorded: founderPitches.length > 0,
    submitted: Boolean(submittedPitch),
    hasBestTake: Boolean(founderPitches.some((pitch) => pitch.is_best_take) || submittedPitch?.pitch?.is_best_take),
    readiness,
    repeatedSignals,
    status: participant.status || 'active',
  };
}

function getFounderStatus(founder: FounderSummary) {
  if (founder.status === 'removed') return { label: 'Removed', tone: 'danger' };
  if (!founder.recorded) return { label: 'Joined', tone: 'neutral' };
  if (!founder.feedbackCount) return { label: 'Recorded', tone: 'neutral' };
  if (!founder.submitted) return { label: 'Needs submission', tone: 'warn' };
  if (!founder.hasBestTake) return { label: 'Submitted', tone: 'mid' };
  return { label: 'Best Take', tone: 'ready' };
}

function getFounderProgressLabel(founder: FounderSummary) {
  if (founder.status === 'removed') return 'Removed from this room.';
  if (!founder.recorded) return 'Joined, waiting for a first recording.';
  if (!founder.feedbackCount) return 'Recorded, but still waiting on feedback.';
  if (!founder.submitted) return 'Has feedback and still needs a final submission.';
  if (!founder.hasBestTake) return 'Submitted, but no Best Take is marked yet.';
  return 'Submitted Best Take and ready for review.';
}

function participantStatusLabel(status?: string | null) {
  if (status === 'removed') return 'Removed';
  if (status === 'invited') return 'Invited';
  return 'Active';
}

function participantStatusTone(status?: string | null) {
  if (status === 'removed') return 'bg-roast/15 text-roast';
  if (status === 'invited') return 'bg-amber-400/15 text-amber-300';
  return 'bg-neon-lime/15 text-neon-lime';
}

function formatDate(value?: string) {
  if (!value) return 'Not set';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'coach') return 'Coach';
  if (role === 'mentor') return 'Mentor';
  if (role === 'judge') return 'Judge';
  if (role === 'organizer') return 'Organizer';
  return 'Founder';
}

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
      error: response.statusText || 'Unexpected response from the event dashboard.',
    };
  }
}

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const slug = params.slug as string;
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [founderInviteEmail, setFounderInviteEmail] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'founder', sendEmail: true });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '' });
  const [lastInvite, setLastInvite] = useState<{ url: string; role: string; email: string; emailStatus?: string | null; emailError?: string | null } | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [createdInviteLink, setCreatedInviteLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/events/${slug}`);
      const data = await readJsonResponse(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not load the event dashboard.');
      }

      setState(data);
    } catch (err) {
      setState(null);
      setError(err instanceof Error ? err.message : 'Could not load the event dashboard.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const event = state?.event;
  const focusTags = useMemo(() => splitFocusSummary(event?.focus), [event?.focus]);
  const participants = useMemo(() => state?.participants || [], [state?.participants]);
  const submissions = useMemo(() => state?.submissions || [], [state?.submissions]);
  const pitches = useMemo(() => state?.pitches || [], [state?.pitches]);
  const invitations = useMemo(() => state?.invitations || [], [state?.invitations]);
  const announcements = useMemo(() => state?.announcements || [], [state?.announcements]);
  const reviewCoverage = useMemo(() => normalizeEventReviewCoverage(state), [state]);
  const founderRows = useMemo(() => participants.filter((item: any) => item.role === 'founder'), [participants]);
  const teamRows = useMemo(() => participants.filter((item: any) => TEAM_ROLES.includes(item.role)), [participants]);
  const founderInvitations = useMemo(
    () => invitations.filter((item: any) => item.role === 'founder' && item.status === 'pending'),
    [invitations]
  );
  const teamInvitations = useMemo(
    () => invitations.filter((item: any) => item.role !== 'founder' && item.status === 'pending'),
    [invitations]
  );
  const founderSummaries = useMemo<FounderSummary[]>(
    () => founderRows.map((participant: any) => buildFounderSummary(participant, pitches, submissions)),
    [founderRows, pitches, submissions]
  );
  const recordedCount = founderSummaries.filter((founder: FounderSummary) => founder.recorded).length;
  const submittedCount = founderSummaries.filter((founder: FounderSummary) => founder.submitted).length;
  const feedbackedCount = founderSummaries.filter((founder: FounderSummary) => founder.feedbackCount > 0).length;
  const bestTakeCount = founderSummaries.filter((founder: FounderSummary) => founder.hasBestTake).length;
  const feedbackCount = pitches.reduce((sum: number, item: any) => sum + (item.feedback?.length || 0), 0);
  const repeatedSignals = useMemo(
    () =>
      summarizeSignals(pitches.flatMap((pitch: any) => pitch.feedback || []))
        .filter((signal) => signal.count > 1)
        .slice(0, 4),
    [pitches]
  );
  const roomUrl = typeof window !== 'undefined' && event ? `${window.location.origin}/events/${event.slug}` : '';
  const practicePrompt = useMemo(() => getPracticePrompt(event?.focus), [event?.focus]);
  const sortedSubmissions = useMemo(
    () =>
      [...submissions].sort((a, b) => {
        const readinessDelta = readinessFromFeedback(b.pitch?.feedback || []) - readinessFromFeedback(a.pitch?.feedback || []);
        if (readinessDelta !== 0) return readinessDelta;
        return new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime();
      }),
    [submissions]
  );
  const organizerName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Organizer';
  const organizerEmail = user?.email || '';
  const organizerAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(organizerName)}`;

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1600);
  };

  const runInviteMutation = async (inviteId: string, action: 'resend' | 'clear_delivery' | 'revoke') => {
    setBusyAction(`invite:${inviteId}:${action}`);
    setActionMessage('');
    setCreatedInviteLink('');
    try {
      const response = await fetch(`/api/events/${slug}/invites`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not update the invite.');
      }

      if (action === 'resend') {
        setActionMessage(
          data.emailStatus === 'sent'
            ? 'Invite email sent.'
            : data.emailStatus === 'not_configured'
              ? 'Invite saved, but email is not configured.'
              : data.emailStatus === 'failed'
                ? `Invite saved, but email failed. ${data.emailError || 'Check the provider response.'}`
                : 'Invite email cleared and ready to resend.'
        );
      } else if (action === 'clear_delivery') {
        setActionMessage('Invite delivery status cleared.');
      } else {
        setActionMessage('Invite revoked.');
      }

      load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not update the invite.');
    } finally {
      setBusyAction('');
    }
  };

  const runParticipantMutation = async (participantId: string, patch: { role?: string; status?: 'active' | 'removed' }) => {
    setBusyAction(`participant:${participantId}`);
    setActionMessage('');
    setCreatedInviteLink('');
    try {
      const response = await fetch(`/api/events/${slug}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, ...patch }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not update the participant.');
      }

      setActionMessage(
        patch.status === 'removed'
          ? 'Participant removed from the room.'
          : patch.status === 'active'
            ? 'Participant restored.'
            : 'Participant updated.'
      );
      load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not update the participant.');
    } finally {
      setBusyAction('');
    }
  };

  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionMessage('');
    setCreatedInviteLink('');
    const response = await fetch(`/api/events/${slug}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...inviteForm,
        sendEmail: inviteForm.sendEmail && Boolean(inviteForm.email.trim()),
      }),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data?.success) {
      setActionMessage(data?.error || 'Could not create invite.');
      return;
    }
    setInviteForm({ email: '', role: inviteForm.role, sendEmail: inviteForm.sendEmail });
    setLastInvite({
      url: data.inviteUrl || '',
      role: data.invitation?.role || inviteForm.role,
      email: data.invitation?.email || inviteForm.email.trim(),
      emailStatus: data.emailStatus || data.invitation?.email_status || null,
      emailError: data.emailError || data.invitation?.email_error || null,
    });
    setActionMessage(
      data.emailStatus === 'sent'
        ? 'Invite emailed and link ready.'
        : data.emailStatus === 'not_configured'
          ? 'Invite created. Email is not configured, so only the link is ready.'
          : data.emailStatus === 'failed'
            ? `Invite created, but email failed. ${data.emailError || 'Check the provider response.'}`
            : 'Invite created. Copy the link or email it later.'
    );
    setCreatedInviteLink(data.inviteUrl || '');
    load();
  };

  const createFounderInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionMessage('');
    setCreatedInviteLink('');
    const response = await fetch(`/api/events/${slug}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: founderInviteEmail, role: 'founder', sendEmail: true }),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data?.success) {
      setActionMessage(data?.error || 'Could not create founder invite.');
      return;
    }
    setFounderInviteEmail('');
    setActionMessage(
      data.emailStatus === 'sent'
        ? 'Founder invite emailed and link ready.'
        : data.emailStatus === 'not_configured'
          ? 'Founder invite created, but email is not configured.'
          : data.emailStatus === 'failed'
            ? `Founder invite created, but email failed. ${data.emailError || 'Check the provider response.'}`
            : 'Founder invite created. Copy the link if you need to send it another way.'
    );
    setCreatedInviteLink(data.inviteUrl || '');
    setLastInvite({
      url: data.inviteUrl || '',
      role: 'founder',
      email: data.invitation?.email || founderInviteEmail.trim(),
      emailStatus: data.emailStatus || data.invitation?.email_status || null,
      emailError: data.emailError || data.invitation?.email_error || null,
    });
    load();
  };

  const createAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionMessage('');
    setCreatedInviteLink('');
    const response = await fetch(`/api/events/${slug}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(announcementForm),
    });
    const data = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok || !data.success) {
      setActionMessage(data.error || 'Could not post announcement.');
      return;
    }
    setAnnouncementForm({ title: '', body: '' });
    setActionMessage(
      data.emailStatus === 'sent'
        ? `Announcement posted and emailed to ${data.recipientCount || 0} founders.`
        : data.emailStatus === 'skipped'
          ? `Announcement posted, but email was skipped. ${data.emailError || 'No founder emails were available.'}`
          : data.emailStatus === 'not_configured'
            ? 'Announcement posted. Email is not configured in this environment.'
            : data.emailStatus === 'failed'
              ? `Announcement posted, but email failed. ${data.emailError || 'Check the provider response.'}`
              : 'Announcement posted.'
    );
    load();
  };

  const assignReviews = async () => {
    setBusyAction('assign-reviews');
    setActionMessage('');
    try {
      const response = await fetch(`/api/events/${slug}/review-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewsPerPitch: event.review_target || 3 }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not assign reviews.');
      }
      setActionMessage(
        data.created > 0
          ? `${data.created} review assignment${data.created === 1 ? '' : 's'} added to participant queues.`
          : 'Review queues are already covered or need at least two active participants and a submitted pitch.'
      );
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not assign reviews.');
    } finally {
      setBusyAction('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return <DashboardShellSkeleton />;
  }

  if (error) {
    return (
      <DashboardErrorState
        title="Could not load the dashboard"
        body={error}
        onRetry={load}
      />
    );
  }

  if (!state?.success || !event) {
    return (
      <DashboardErrorState
        title="Event not found"
        body="Double-check the event link or ask the organizer to share the correct room."
        onRetry={load}
      />
    );
  }

  if (!state.isTeamMember) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-bold">Event team access only.</h1>
        <p className="mt-3 max-w-md text-slate-400">Founders should use the event invite page to join, record, and submit their best take.</p>
        <Link href={`/events/${slug}`} className="mt-5 rounded-full bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
          Open founder view
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-heading font-bold text-slate-200 sm:w-auto"
          >
            <Video className="h-4 w-4 text-neon-cyan" />
            Founder app
          </Link>

          <div className="glass-card flex items-center justify-between gap-3 rounded-full p-2 pl-2.5 sm:justify-end">
            <Link href="/me" className="flex min-w-0 items-center gap-3 rounded-full pr-1 transition hover:opacity-85">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={organizerAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full border border-white/15 object-cover" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-heading font-black text-white">{organizerName}</span>
                {organizerEmail ? <span className="block truncate text-xs font-semibold text-slate-400">{organizerEmail}</span> : null}
              </span>
            </Link>
            <Link
              href="/me"
              className="btn-glass hidden items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-heading font-bold text-slate-200 sm:inline-flex"
            >
              <UserCircle2 className="h-4 w-4" />
              Profile
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-heading font-bold text-slate-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        <section className="glass-panel rounded-[2rem] p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
                <Sparkles className="h-4 w-4" />
                Event room
              </div>
              <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">{event.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Team workspace for invite tracking, final takes, feedback coverage, and founder announcements.
              </p>
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
                {event.description && <p className="mt-3 text-sm leading-6 text-slate-300">{event.description}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => copyText(roomUrl, 'event')} className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold text-white">
                <Copy className="h-4 w-4" />
                {copied === 'event' ? 'Copied' : 'Copy room page'}
              </button>
              <Link href={`/events/${slug}`} className="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold">
                Founder view
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric icon={Users} label="Founders" value={founderRows.length} />
            <Metric icon={Trophy} label="Final takes" value={submissions.length} />
            <Metric icon={MessageSquareText} label="Feedback" value={feedbackCount} />
            <Metric icon={Video} label="Pitch length" value={formatPitchLength(event.pitch_length_seconds)} />
            <Metric icon={CalendarDays} label="Pitch day" value={formatDate(event.event_date)} />
          </div>
          {event.pitch_hour_starts_at ? <PitchHourPanel event={event} /> : null}
          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            {reviewCoverage ? <ReviewCoverageStrip coverage={reviewCoverage} /> : <div />}
            {state.canManageEvent ? (
              <button
                type="button"
                onClick={assignReviews}
                disabled={busyAction === 'assign-reviews' || submissions.length === 0}
                className="btn-glass inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-heading font-bold disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ListChecks className="h-4 w-4 text-neon-cyan" />
                {busyAction === 'assign-reviews' ? 'Assigning...' : 'Assign pitch reviews'}
              </button>
            ) : null}
          </div>
        </section>

        <div className="mt-5 overflow-x-auto">
          <div className="glass-card inline-flex min-w-full gap-1 rounded-full p-1 sm:min-w-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm font-black capitalize tracking-wide transition ${
                  activeTab === tab ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {actionMessage && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">
            <p>{actionMessage}</p>
            {createdInviteLink ? (
              <div className="mt-3 flex flex-col gap-2 rounded-xl bg-black/30 p-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate text-xs text-slate-300">{createdInviteLink}</code>
                <button
                  type="button"
                  onClick={() => copyText(createdInviteLink, 'created-invite')}
                  className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === 'created-invite' ? 'Copied' : 'Copy invite'}
                </button>
              </div>
            ) : null}
          </div>
        )}

        <section className="mt-5">
          {activeTab === 'overview' && (
            <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
              <Panel title="Founder progress" eyebrow="Overview">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <StatusTile label="Joined" value={founderSummaries.length} />
                  <StatusTile label="Recorded" value={recordedCount} />
                  <StatusTile label="Submitted" value={submittedCount} />
                  <StatusTile label="With feedback" value={feedbackedCount} />
                  <StatusTile label="Best takes" value={bestTakeCount} />
                </div>
                <div className="mt-5 space-y-3">
                  {founderSummaries.slice(0, 5).map((founder) => (
                    <FounderRow key={founder.participant.id} founder={founder} />
                  ))}
                  {!founderSummaries.length && <EmptyState text="No founders have joined yet. Create founder invites from the Team tab." />}
                </div>
              </Panel>

              <div className="grid gap-5">
                <Panel title="Repeated signals" eyebrow="Feedback pulse">
                  {repeatedSignals.length ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {repeatedSignals.map((signal) => (
                          <span key={signal.label} className="rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-3 py-1 text-sm font-bold text-neon-cyan">
                            {signal.label} · {signal.count}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm leading-6 text-slate-400">
                        The most repeated notes show up here so organizers can nudge the room toward the next improvement.
                      </p>
                    </div>
                  ) : (
                    <EmptyState text="Repeated signals will appear once multiple founders get the same feedback note." />
                  )}
                </Panel>

                <Panel title="Latest announcements" eyebrow="Comms">
                  <div className="mb-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Suggested founder nudge</p>
                    <h3 className="mt-2 font-heading text-lg font-bold text-white">{practicePrompt.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{practicePrompt.prompt}</p>
                  </div>
                  <AnnouncementList announcements={announcements.slice(0, 4)} />
                </Panel>
              </div>
            </div>
          )}

          {activeTab === 'founders' && (
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Invite founders" eyebrow={state.canManageEvent ? 'Founder access' : 'Read only'}>
                {state.canManageEvent ? (
                  <form onSubmit={createFounderInvite} className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-300">Founder email</span>
                      <input
                        type="email"
                        value={founderInviteEmail}
                        onChange={(e) => setFounderInviteEmail(e.target.value)}
                        className="input-dark"
                        placeholder="founder@company.com"
                        required
                      />
                      <p className="mt-2 text-xs leading-5 text-slate-500">We email the invite by default and still give you a copyable link after creation.</p>
                    </label>
                    <button
                      disabled={saving}
                      className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold disabled:opacity-60"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create founder invite
                    </button>
                    <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-300">
                      This creates a tracked founder invite and sends the email when possible. The invite link stays available for follow-up.
                    </p>
                  </form>
                ) : (
                  <EmptyState text="Only organizers and admins can invite founders." />
                )}
              </Panel>

              <Panel title="Founder roster" eyebrow="Participants">
                <div className="grid gap-3 md:grid-cols-2">
                  {founderSummaries.map((founder) => (
                    <FounderRow
                      key={founder.participant.id}
                      founder={founder}
                      detailed
                      canManage={state.canManageEvent && founder.participant.user_id !== event.organizer_id}
                      busyAction={busyAction}
                      onUpdateParticipant={runParticipantMutation}
                    />
                  ))}
                  {!founderSummaries.length && <EmptyState text="No founders have joined this event yet." />}
                </div>
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Founder invites</p>
                  {founderInvitations.map((invite: any) => (
                    <InviteRow
                      key={invite.id}
                      invite={invite}
                      eventSlug={event.slug}
                      copied={copied}
                      onCopy={copyText}
                      canManage={state.canManageEvent}
                      busyAction={busyAction}
                      onResend={() => runInviteMutation(invite.id, 'resend')}
                      onClear={() => runInviteMutation(invite.id, 'clear_delivery')}
                      onRevoke={() => runInviteMutation(invite.id, 'revoke')}
                    />
                  ))}
                  {!founderInvitations.length && <EmptyState text="No pending founder invites yet." />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'submissions' && (
            <Panel title="Submission review" eyebrow="Team visible">
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusTile label="Final takes" value={sortedSubmissions.length} />
                <StatusTile label="Ready for review" value={submittedCount} />
                <StatusTile label="Feedback items" value={feedbackCount} />
                <StatusTile label="Best takes" value={bestTakeCount} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))}
                {!sortedSubmissions.length && <EmptyState text="No final takes submitted yet." />}
              </div>
            </Panel>
          )}

          {activeTab === 'team' && (
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Create invite" eyebrow={state.canManageEvent ? 'Organizer/Admin' : 'Read only'}>
                {state.canManageEvent ? (
                  <form onSubmit={createInvite} className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-300">Email</span>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        className="input-dark"
                        placeholder="founder@company.com or leave blank for a copyable link"
                      />
                      <p className="mt-2 text-xs leading-5 text-slate-500">Leave blank for link-only access or add an email to send the invite now.</p>
                    </label>
                    <label className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={inviteForm.sendEmail}
                        onChange={(e) => setInviteForm({ ...inviteForm, sendEmail: e.target.checked })}
                        className="h-5 w-5 accent-neon-cyan"
                      />
                      <span className="text-sm font-bold text-slate-200">Email invite when an address is set</span>
                    </label>
                    <div className="space-y-4">
                      {INVITE_ROLE_GROUPS.map((group) => (
                        <div key={group.label} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-400">{group.helper}</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                              {group.roles.length} role{group.roles.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.roles.map((role) => {
                              const selected = inviteForm.role === role;
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => setInviteForm({ ...inviteForm, role })}
                                  className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                                    selected
                                      ? 'border-neon-cyan bg-neon-cyan text-slate-950 shadow-lg shadow-neon-cyan/15'
                                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-neon-cyan/45 hover:text-white'
                                  }`}
                                >
                                  {roleLabel(role)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button disabled={saving} className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold disabled:opacity-60">
                      <UserPlus className="h-4 w-4" />
                      Create invite
                    </button>
                  </form>
                ) : (
                  <EmptyState text="Only organizers and admins can create invites." />
                )}
              </Panel>

              <Panel title="Team and invites" eyebrow="Access">
                <div className="grid gap-3 md:grid-cols-2">
                  {teamRows.map((member: any) => (
                    <PersonCard
                      key={member.id}
                      person={member}
                      role={member.role}
                      canManage={state.canManageEvent && member.user_id !== event.organizer_id}
                      busyAction={busyAction}
                      onUpdateParticipant={runParticipantMutation}
                    />
                  ))}
                </div>
                {lastInvite && (
                  <div className="mt-5 rounded-3xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Latest invite</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-white">{roleLabel(lastInvite.role)} invite ready</p>
                        <p className="text-sm leading-6 text-slate-300">
                          {lastInvite.emailStatus === 'sent'
                            ? `Sent to ${lastInvite.email}.`
                            : lastInvite.emailStatus === 'failed'
                              ? `Email failed. ${readableEmailError(lastInvite.emailError || '')}`
                              : lastInvite.emailStatus === 'not_configured'
                                ? 'Email is not configured, so only the link is ready.'
                                : lastInvite.email
                                  ? `Ready for ${lastInvite.email}.`
                                  : 'Copy the link and send it to the right person.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => copyText(lastInvite.url, 'latest-invite')} className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
                          <Copy className="h-4 w-4" />
                          {copied === 'latest-invite' ? 'Copied' : 'Copy link'}
                        </button>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${inviteEmailStatusTone(lastInvite.emailStatus)}`}>
                          {inviteEmailStatusLabel(lastInvite.emailStatus)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pending team invites</p>
                  {teamInvitations.map((invite: any) => (
                    <InviteRow
                      key={invite.id}
                      invite={invite}
                      eventSlug={event.slug}
                      copied={copied}
                      onCopy={copyText}
                      canManage={state.canManageEvent}
                      busyAction={busyAction}
                      onResend={() => runInviteMutation(invite.id, 'resend')}
                      onClear={() => runInviteMutation(invite.id, 'clear_delivery')}
                      onRevoke={() => runInviteMutation(invite.id, 'revoke')}
                    />
                  ))}
                  {!teamInvitations.length && <EmptyState text="No pending team invites yet. Founder invites live in the Founders tab." />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Post founder nudge" eyebrow="Organizer/Admin">
                <form onSubmit={createAnnouncement} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Title</span>
                    <input
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="input-dark"
                      placeholder="Before Friday: sharpen sentence one"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Message</span>
                    <textarea
                      value={announcementForm.body}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                      className="input-dark min-h-32 resize-y"
                      placeholder="Record one 60-second rep today. Start with the customer, cut the filler, and end with one specific ask."
                      required
                    />
                  </label>
                  <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-300">
                    This posts a simple founder announcement and emails the active founders in the room when Resend is configured.
                  </p>
                  <button disabled={saving} className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold disabled:opacity-60">
                    <Send className="h-4 w-4" />
                    Post announcement
                  </button>
                </form>
              </Panel>

              <Panel title="Announcement history" eyebrow="Visible in event room">
                <AnnouncementList announcements={announcements} />
              </Panel>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-2xl font-black text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <Icon className="mb-3 h-5 w-5 text-neon-cyan" />
      <p className="font-heading text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="font-heading text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="text-white">{value}</span>
    </span>
  );
}

function FounderRow({
  founder,
  detailed = false,
  canManage = false,
  busyAction = '',
  onUpdateParticipant,
}: {
  founder: FounderSummary;
  detailed?: boolean;
  canManage?: boolean;
  busyAction?: string;
  onUpdateParticipant?: (participantId: string, patch: { role?: string; status?: 'active' | 'removed' }) => void;
}) {
  const status = getFounderStatus(founder);
  const latestPitch = founder.latestPitch || founder.submittedPitch?.pitch || null;
  const participantActionBusy = busyAction === `participant:${founder.participant.id}`;
  const participantStatus = participantStatusLabel(founder.participant.status);
  const isRemoved = founder.participant.status === 'removed';

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start gap-3">
        <img
          src={founder.participant.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
          alt={founder.participant.profile?.full_name || 'Founder'}
          className="h-11 w-11 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{founder.participant.profile?.full_name || 'Founder'}</p>
          <p className="text-sm text-slate-400">{getFounderProgressLabel(founder)}</p>
          <p className="mt-1 text-xs text-slate-500">Joined {formatDate(founder.joinedAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              status.tone === 'ready'
                ? 'bg-neon-lime text-slate-950'
                : status.tone === 'warn'
                  ? 'bg-roast/15 text-roast'
                  : status.tone === 'danger'
                    ? 'bg-roast/15 text-roast'
                    : 'bg-white/10 text-slate-300'
            }`}
          >
            {status.label}
          </span>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${participantStatusTone(founder.participant.status)}`}>
            {participantStatus}
          </span>
          {canManage && onUpdateParticipant ? (
            <button
              type="button"
              disabled={participantActionBusy}
              onClick={() => onUpdateParticipant(founder.participant.id, { status: isRemoved ? 'active' : 'removed' })}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
            >
              {participantActionBusy ? 'Working...' : isRemoved ? 'Restore' : 'Deactivate'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MetaPill label="Recorded" value={founder.pitches.length} />
        <MetaPill label="Feedback" value={founder.feedbackCount} />
        <MetaPill label="Submitted" value={founder.submitted ? 'Yes' : 'No'} />
        <MetaPill label="Best take" value={founder.hasBestTake ? 'Yes' : 'No'} />
        <MetaPill label="Readiness" value={readinessLabel(founder.readiness)} />
      </div>

      {latestPitch ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-neon-cyan">
              {getTakeLabelFromFields(latestPitch)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {latestPitch.created_at ? formatDate(latestPitch.created_at) : 'Latest recording'}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-white">{latestPitch.hook}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{getFounderProgressLabel(founder)}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
          Waiting for the first recording.
        </div>
      )}

      {detailed && founder.repeatedSignals.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {founder.repeatedSignals.map((signal) => (
            <span key={signal.label} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300">
              {signal.label} · {signal.count}
            </span>
          ))}
        </div>
      ) : null}

      {detailed && founder.participant.profile?.linkedin_url ? (
        <p className="mt-4 truncate text-xs text-slate-500">{founder.participant.profile.linkedin_url}</p>
      ) : null}
    </article>
  );
}

function PersonCard({
  person,
  role,
  canManage = false,
  busyAction = '',
  onUpdateParticipant,
}: {
  person: any;
  role: string;
  canManage?: boolean;
  busyAction?: string;
  onUpdateParticipant?: (participantId: string, patch: { role?: string; status?: 'active' | 'removed' }) => void;
}) {
  const participantActionBusy = busyAction === `participant:${person.id}`;
  const isRemoved = person.status === 'removed';
  const editableRoles = ['organizer', 'admin', 'coach', 'mentor', 'judge'] as const;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start gap-3">
        <img
          src={person.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
          alt={person.profile?.full_name || role}
          className="h-11 w-11 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{person.profile?.full_name || roleLabel(role)}</p>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{roleLabel(role)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${participantStatusTone(person.status)}`}>
            {participantStatusLabel(person.status)}
          </span>
          {canManage && onUpdateParticipant ? (
            <button
              type="button"
              disabled={participantActionBusy}
              onClick={() => onUpdateParticipant(person.id, { status: isRemoved ? 'active' : 'removed' })}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
            >
              {participantActionBusy ? 'Working...' : isRemoved ? 'Restore' : 'Deactivate'}
            </button>
          ) : null}
        </div>
      </div>

      {canManage && onUpdateParticipant ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="min-w-0 flex-1">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Role</span>
            <select
              value={role}
              onChange={(e) => onUpdateParticipant(person.id, { role: e.target.value })}
              disabled={participantActionBusy || isRemoved}
              className="input-dark"
            >
              {editableRoles.map((editableRole) => (
                <option key={editableRole} value={editableRole}>
                  {roleLabel(editableRole)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function InviteRow({
  invite,
  copied,
  onCopy,
  canManage = false,
  busyAction = '',
  onResend,
  onClear,
  onRevoke,
  eventSlug,
}: {
  invite: any;
  copied: string;
  onCopy: (value: string, label: string) => void;
  canManage?: boolean;
  busyAction?: string;
  onResend?: () => void;
  onClear?: () => void;
  onRevoke?: () => void;
  eventSlug?: string;
}) {
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${eventSlug}?invite=${invite.invite_code}`;
  const hasEmail = Boolean(invite.email);
  const resendBusy = busyAction === `invite:${invite.id}:resend`;
  const clearBusy = busyAction === `invite:${invite.id}:clear_delivery`;
  const revokeBusy = busyAction === `invite:${invite.id}:revoke`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="min-w-0">
        <p className="truncate font-bold text-white">{invite.email || `${roleLabel(invite.role)} invite`}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {roleLabel(invite.role)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {invite.status}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${inviteEmailStatusTone(invite.email_status)}`}>
            {inviteEmailStatusLabel(invite.email_status)}
          </span>
          {invite.email_sent_at ? (
            <span className="text-[11px] font-semibold text-slate-500">Sent {formatDate(invite.email_sent_at)}</span>
          ) : null}
        </div>
        {invite.email_error ? <p className="mt-3 rounded-xl border border-roast/20 bg-roast/10 px-3 py-2 text-xs leading-5 text-roast">{readableEmailError(invite.email_error)}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCopy(link, invite.id)}
          className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
        >
          <Copy className="h-4 w-4" />
          {copied === invite.id ? 'Copied' : 'Copy link'}
        </button>
        {canManage && onResend && hasEmail && invite.status === 'pending' ? (
          <button
            type="button"
            disabled={resendBusy}
            onClick={onResend}
            className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {resendBusy ? 'Sending...' : invite.email_status === 'sent' ? 'Resend' : 'Send email'}
          </button>
        ) : null}
        {canManage && onClear && invite.status === 'pending' && (invite.email_status !== 'unknown' || invite.email_error) ? (
          <button
            type="button"
            disabled={clearBusy}
            onClick={onClear}
            className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {clearBusy ? 'Clearing...' : 'Clear status'}
          </button>
        ) : null}
        {canManage && onRevoke && invite.status === 'pending' ? (
          <button
            type="button"
            disabled={revokeBusy}
            onClick={onRevoke}
            className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {revokeBusy ? 'Revoking...' : 'Revoke'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: any }) {
  const readiness = readinessFromFeedback(submission.pitch?.feedback || []);
  const repeatedSignals = summarizeSignals(submission.pitch?.feedback || []).slice(0, 3);
  const takeLabel = getTakeLabelFromFields(submission.pitch || {});

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-black/35">
      <Link href={pitchPath(submission.pitch?.public_id, submission.pitch_id) || '#'} className="group relative block aspect-[9/16] bg-slate-950">
        {submission.pitch?.thumbnail_url ? (
          <img src={submission.pitch.thumbnail_url} alt={submission.pitch.hook} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-10 w-10 text-white/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-neon-lime px-2 py-1 text-xs font-black text-slate-950">Final Take</span>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="line-clamp-2 font-bold text-white">{submission.pitch?.hook}</p>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={submission.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
            alt={submission.profile?.full_name || 'Founder'}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{submission.profile?.full_name || 'Founder'}</p>
            <p className="text-xs text-slate-500">{readinessLabel(readiness)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-neon-cyan">
            {takeLabel}
          </span>
          {submission.pitch?.is_best_take ? (
            <span className="rounded-full bg-neon-lime px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950">
              Best Take
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Toast" value={submission.pitch?.toast_count || 0} />
          <Mini label="Roast" value={submission.pitch?.roast_count || 0} />
          <Mini label="Notes" value={submission.pitch?.feedback?.length || 0} />
        </div>
        {repeatedSignals.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {repeatedSignals.map((signal) => (
              <span key={signal.label} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300">
                {signal.label} · {signal.count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No repeated signal yet.</p>
        )}
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.05] p-2">
      <p className="font-heading text-lg font-black text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function ReviewCoverageStrip({ coverage }: { coverage: EventReviewCoverage }) {
  const completionRate = coverage.completionRate ?? (
    coverage.reviewsAssigned > 0 ? Math.round((coverage.reviewsCompleted / coverage.reviewsAssigned) * 100) : 0
  );
  const firstReview = coverage.averageTimeToFirstReviewMinutes;
  const firstReviewLabel = firstReview === null || typeof firstReview === 'undefined'
    ? 'Not available'
    : firstReview < 60
      ? `${Math.round(firstReview)} min`
      : `${Math.round(firstReview / 6) / 10} hr`;

  const items = [
    { label: 'Assigned', value: coverage.reviewsAssigned },
    { label: 'Completed', value: coverage.reviewsCompleted },
    { label: 'Uncovered pitches', value: coverage.pitchesWithoutFeedback, alert: coverage.pitchesWithoutFeedback > 0 },
    ...(coverage.usefulReviews === null || typeof coverage.usefulReviews === 'undefined' ? [] : [{ label: 'Useful reviews', value: coverage.usefulReviews }]),
    { label: 'First review', value: firstReviewLabel },
  ];

  return (
    <div className="w-full min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 p-4" aria-label="Review coverage">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-neon-cyan" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Review coverage</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${completionRate >= 80 ? 'bg-neon-lime/15 text-neon-lime' : 'bg-amber-400/15 text-amber-300'}`}>
          {completionRate}% complete
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl border p-3 ${item.alert ? 'border-roast/25 bg-roast/10' : 'border-white/10 bg-white/[0.04]'}`}>
            <p className={`font-heading text-lg font-black ${item.alert ? 'text-roast' : 'text-white'}`}>{item.value}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
      {coverage.foundersWithoutUsefulFeedback !== null && typeof coverage.foundersWithoutUsefulFeedback !== 'undefined' && coverage.foundersWithoutUsefulFeedback > 0 ? (
        <p className="mt-3 text-xs font-semibold text-amber-300" role="status">
          {coverage.foundersWithoutUsefulFeedback} founder{coverage.foundersWithoutUsefulFeedback === 1 ? '' : 's'} still need useful feedback.
        </p>
      ) : null}
    </div>
  );
}

function PitchHourPanel({ event }: { event: any }) {
  const startsAt = new Date(event.pitch_hour_starts_at);
  const endsAt = event.pitch_hour_ends_at ? new Date(event.pitch_hour_ends_at) : null;
  if (Number.isNaN(startsAt.getTime())) return null;

  const date = startsAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = endsAt && !Number.isNaN(endsAt.getTime())
    ? endsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neon-cyan/10 text-neon-cyan">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neon-cyan">Pitch Hour</p>
          <p className="mt-1 font-heading text-base font-black text-white">{date} · {start}{end ? `-${end}` : ''}</p>
          <p className="mt-1 text-xs text-slate-400">Use this window to create review queues and close feedback gaps together.</p>
        </div>
      </div>
      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-slate-300">
        {event.review_target || 3} reviews per queue
      </span>
    </div>
  );
}

function AnnouncementList({ announcements }: { announcements: any[] }) {
  if (!announcements.length) {
    return <EmptyState text="No announcements yet." />;
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <article key={announcement.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neon-cyan/15 text-neon-cyan">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-lg font-bold text-white">{announcement.title}</h3>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {announcement.audience === 'founders' ? 'Founders' : announcement.audience}
                </span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${announcementEmailStatusTone(announcement.email_status)}`}>
                  {announcementEmailStatusLabel(announcement.email_status)}
                </span>
              </div>
              <p className="mt-2 leading-6 text-slate-300">{announcement.body}</p>
              {announcement.email_error ? (
                <p className="mt-2 rounded-xl border border-roast/20 bg-roast/10 px-3 py-2 text-xs leading-5 text-roast">
                  {readableEmailError(announcement.email_error)}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">
                <Mail className="mr-1 inline h-3.5 w-3.5" />
                {announcement.author?.full_name || 'Event team'} · {new Date(announcement.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-400">{text}</p>;
}

function DashboardShellSkeleton() {
  return (
    <div className="min-h-screen bg-background text-white">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="glass-panel rounded-[2rem] p-5 sm:p-7">
          <div className="animate-pulse space-y-5">
            <div className="h-4 w-32 rounded-full bg-white/10" />
            <div className="h-10 w-2/3 rounded-2xl bg-white/10" />
            <div className="h-5 w-5/6 rounded-full bg-white/10" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="h-[28rem] rounded-[2rem] border border-white/10 bg-white/[0.03]" />
          <div className="grid gap-5">
            <div className="h-60 rounded-[2rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-60 rounded-[2rem] border border-white/10 bg-white/[0.03]" />
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardErrorState({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-white">
      <div className="glass-panel w-full max-w-xl rounded-[2rem] p-6 text-center sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-roast/15 text-roast">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="font-heading text-3xl font-black">{title}</h1>
        <p className="mt-3 leading-7 text-slate-400">{body}</p>
        <button onClick={onRetry} className="cta-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 font-heading font-bold">
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
