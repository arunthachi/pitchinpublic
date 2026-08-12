'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  LogOut,
  ListChecks,
  Mail,
  MessageSquareText,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
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
import {
  DASHBOARD_TABS,
  PERSISTENT_DASHBOARD_TABS,
  buildDashboardHref,
  founderMatchesFilter,
  getDashboardActionCounts,
  getDashboardPrimaryAction,
  getDeadlineState,
  getInvitationHealth,
  getNextFeedbackSubmission,
  parseBulkFounderEmails,
  parseDashboardState,
  submissionMatchesFilter,
  type DashboardFilter,
  type DashboardTab,
} from '@/lib/event-dashboard';
import { splitEventFocuses } from '@/lib/event-settings';
import { readJsonResponse } from '@/lib/http';
import type { EventReviewCoverage } from '@/types';
import { EventEditDialog } from '@/components/EventEditDialog';
import { EmailChipInput } from '@/components/EmailChipInput';
import { ActionPageNav } from '@/components/ActionPageNav';
import { destination, eventDashboardDestination } from '@/lib/app-navigation';
import { PitchGuidelinesEditor } from '@/components/event-guidance/PitchGuidelinesEditor';

const DASHBOARD_TAB_LABELS: Record<DashboardTab, string> = {
  overview: 'Pitch readiness',
  founders: 'Founders',
  submissions: 'Pitches & feedback',
  team: 'Team',
  announcements: 'Announcements',
};

const TEAM_ROLES = ['organizer', 'admin', 'coach', 'mentor', 'judge'];
const INVITE_ROLE_GROUPS = [
  {
    label: 'Team',
    helper: 'Invite organizers, admins, coaches, mentors, and judges who can help review the room.',
    roles: ['organizer', 'admin', 'coach', 'mentor', 'judge'],
  },
] as const;
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

function participantDisplayName(profile?: {
  full_name?: string | null;
  username?: string | null;
  public_handle?: string | null;
} | null) {
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;

  const handle = profile?.public_handle?.trim() || profile?.username?.trim();
  if (handle) return `@${handle.replace(/^@/, '')}`;

  return 'Unnamed participant';
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [activeFilter, setActiveFilter] = useState<DashboardFilter | null>(null);
  const [founderInviteEmails, setFounderInviteEmails] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'organizer', sendEmail: true });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '' });
  const [lastInvite, setLastInvite] = useState<{ url: string; role: string; email: string; emailStatus?: string | null; emailError?: string | null } | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [createdInviteLink, setCreatedInviteLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [createdState, setCreatedState] = useState<{ active: boolean; invited: number; failed: number }>({ active: false, invited: 0, failed: 0 });

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

  useEffect(() => {
    const syncFromLocation = () => {
      const next = parseDashboardState(window.location.search);
      setActiveTab(next.tab);
      setActiveFilter(next.filter);
      const params = new URLSearchParams(window.location.search);
      setCreatedState({
        active: params.get('created') === '1',
        invited: Math.max(0, Number(params.get('invited') || 0)),
        failed: Math.max(0, Number(params.get('inviteFailed') || 0)),
      });
      window.requestAnimationFrame(() => {
        const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
        target?.focus();
      });
    };
    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  const event = state?.event;
  const focusTags = useMemo(() => splitEventFocuses(event?.focus), [event?.focus]);
  const participants = useMemo(() => state?.participants || [], [state?.participants]);
  const submissions = useMemo(() => state?.submissions || [], [state?.submissions]);
  const pitches = useMemo(() => state?.pitches || [], [state?.pitches]);
  const invitations = useMemo(() => state?.invitations || [], [state?.invitations]);
  const announcements = useMemo(() => state?.announcements || [], [state?.announcements]);
  const reviewCoverage = useMemo(() => normalizeEventReviewCoverage(state), [state]);
  const founderRows = useMemo(() => participants.filter((item: any) => item.role === 'founder'), [participants]);
  const teamRows = useMemo(() => participants.filter((item: any) => TEAM_ROLES.includes(item.role)), [participants]);
  const activeReviewers = useMemo(
    () => teamRows.filter((item: any) => item.status !== 'removed' && ['coach', 'mentor', 'judge'].includes(item.role)).length,
    [teamRows]
  );
  const founderInvitations = useMemo(
    () => invitations.filter((item: any) => item.role === 'founder'),
    [invitations]
  );
  const teamInvitations = useMemo(
    () => invitations.filter((item: any) => item.role !== 'founder'),
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
  const actionCounts = useMemo(
    () => getDashboardActionCounts(founderSummaries, submissions),
    [founderSummaries, submissions]
  );
  const activeFounderCount = founderRows.filter((item: any) => item.status !== 'removed').length;
  const activeFounderInviteCount = founderInvitations.filter((item: any) => item.status !== 'revoked').length;
  const hasFounderAccess = activeFounderCount > 0 || activeFounderInviteCount > 0;
  const primaryAction = useMemo(
    () => getDashboardPrimaryAction({
      activeFounderCount,
      activeFounderInviteCount,
      needsFeedback: actionCounts.needsFeedback,
      notSubmitted: actionCounts.notSubmitted,
    }),
    [actionCounts.needsFeedback, actionCounts.notSubmitted, activeFounderCount, activeFounderInviteCount]
  );
  const deadlineState = useMemo(() => getDeadlineState(event?.submission_deadline), [event?.submission_deadline]);
  const filteredFounders = useMemo(
    () => founderSummaries.filter((founder) => founderMatchesFilter(founder, activeFilter)),
    [activeFilter, founderSummaries]
  );
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
  const filteredSubmissions = useMemo(
    () => sortedSubmissions.filter((submission) => submissionMatchesFilter(submission, activeFilter)),
    [activeFilter, sortedSubmissions]
  );
  const firstNeedsFeedbackSubmission = getNextFeedbackSubmission(submissions);
  const firstNeedsFeedbackPath = firstNeedsFeedbackSubmission
    ? pitchPath(firstNeedsFeedbackSubmission.pitch?.public_id, firstNeedsFeedbackSubmission.pitch_id)
    : null;
  const reviewNextHref = firstNeedsFeedbackPath
    ? `${firstNeedsFeedbackPath}?feedback=1&event=${encodeURIComponent(slug)}`
    : null;
  const setDashboardView = (tab: DashboardTab, filter: DashboardFilter | null = null) => {
    const href = buildDashboardHref(window.location.pathname, tab, filter);
    router.push(href, { scroll: false });
    setActiveTab(tab);
    setActiveFilter(filter);
    setActionMessage('');
    setCreatedInviteLink('');
    window.requestAnimationFrame(() => {
      document.getElementById(`dashboard-panel-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById(`dashboard-panel-${tab}`)?.focus();
    });
  };

  const dismissCreatedState = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('created');
    url.searchParams.delete('invited');
    url.searchParams.delete('inviteFailed');
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    setCreatedState({ active: false, invited: 0, failed: 0 });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? PERSISTENT_DASHBOARD_TABS.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + PERSISTENT_DASHBOARD_TABS.length) % PERSISTENT_DASHBOARD_TABS.length;
    const nextTab = PERSISTENT_DASHBOARD_TABS[nextIndex];
    setDashboardView(nextTab);
    document.getElementById(`dashboard-tab-${nextTab}`)?.focus();
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1600);
  };

  const runInviteMutation = async (inviteId: string, action: 'resend' | 'revoke') => {
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
    try {
      const response = await fetch(`/api/events/${slug}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inviteForm,
          sendEmail: inviteForm.sendEmail && Boolean(inviteForm.email.trim()),
        }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not create invite.');
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
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not create invite.');
    } finally {
      setSaving(false);
    }
  };

  const viewFounderDeck = async (userId: string) => {
    // Open the tab synchronously so popup blockers allow it. `noopener` in the
    // feature string would make window.open return null, so sever the opener
    // reference manually before navigating to the (possibly external) URL.
    const deckWindow = window.open('about:blank', '_blank');
    if (deckWindow) deckWindow.opener = null;
    try {
      const response = await fetch(`/api/events/${slug}/decks/${userId}`);
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success || !data.url) {
        throw new Error(data?.error || 'Could not open the deck.');
      }
      if (deckWindow) deckWindow.location.href = data.url;
      else window.open(data.url, '_blank', 'noopener');
    } catch (error) {
      deckWindow?.close();
      setActionMessage(error instanceof Error ? error.message : 'Could not open the deck.');
    }
  };

  const createFounderInvite = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseBulkFounderEmails(founderInviteEmails.join(','));
    if (parsed.invalid.length || parsed.overflow || !parsed.emails.length) {
      setActionMessage(
        parsed.invalid.length
          ? `Fix ${parsed.invalid.length} invalid email address${parsed.invalid.length === 1 ? '' : 'es'} before inviting.`
          : parsed.overflow
            ? 'Invite up to 50 founders at a time.'
            : 'Add at least one founder email.'
      );
      return;
    }
    setSaving(true);
    setActionMessage('');
    setCreatedInviteLink('');
    try {
      const response = await fetch(`/api/events/${slug}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: parsed.emails, role: 'founder', sendEmail: true }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not create founder invite.');
      const results = Array.isArray(data.results) ? data.results : [];
      const firstCreated = results.find((result: any) => result.success);
      setFounderInviteEmails([]);
      const created = Number(data.created || 0);
      const sent = Number(data.sent || 0);
      const failed = Number(data.failed || 0);
      const emailFailed = Number(data.emailFailed || 0);
      setActionMessage(
        failed
          ? `${created} founder invite${created === 1 ? '' : 's'} created; ${failed} failed. Retry the failed addresses.`
          : emailFailed
            ? `${created} invite${created === 1 ? '' : 's'} ready, but ${emailFailed} email${emailFailed === 1 ? '' : 's'} could not be sent. Copy the invite link below.`
            : sent
              ? `${sent} founder invitation email${sent === 1 ? '' : 's'} sent.`
              : created
                ? `${created} founder invite${created === 1 ? '' : 's'} created.`
                : 'These founders already have active event access or invitations.'
      );
      if (results.length === 1 && firstCreated) {
        setCreatedInviteLink(firstCreated.inviteUrl || '');
        setLastInvite({
          url: firstCreated.inviteUrl || '',
          role: 'founder',
          email: firstCreated.email,
          emailStatus: firstCreated.emailStatus || null,
          emailError: firstCreated.emailError || null,
        });
      }
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not create founder invite.');
    } finally {
      setSaving(false);
    }
  };

  const createAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionMessage('');
    setCreatedInviteLink('');
    try {
      const response = await fetch(`/api/events/${slug}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementForm),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not post announcement.');
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
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not post announcement.');
    } finally {
      setSaving(false);
    }
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

  const handleEventSaved = (updatedEvent: any) => {
    setState((current: any) => ({ ...current, event: updatedEvent }));
    setActionMessage('Event settings saved.');
  };

  const openSetupTab = (tab: DashboardTab) => {
    setDashboardView(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(`dashboard-panel-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-bold">Event team access only.</h1>
        <p className="mt-3 max-w-md text-slate-400">Founders should use the event invite page to join, record, and submit their best take.</p>
        <Link href={`/events/${slug}`} className="mt-5 rounded-full bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
          Open founder view
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-white">
      <ActionPageNav
        ariaLabel="Event dashboard navigation"
        links={[
          destination(state.canManageEvent ? 'myEvents' : 'eventWorkspaces'),
          eventDashboardDestination(slug, true),
          destination('feed'),
        ]}
        account={user ? { email: user.email, profileHref: '/me', onSignOut: handleSignOut } : undefined}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {createdState.active ? (
          <div className="mb-5">
            <PitchGuidelinesEditor eventSlug={slug} canManage={state.canManageEvent} initiallyOpen />
          </div>
        ) : null}
        {createdState.active ? (
          <section className="mb-5 rounded-2xl border border-neon-lime/25 bg-neon-lime/10 p-4" aria-labelledby="event-created-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-neon-lime">Event created</p>
                <h1 id="event-created-title" className="mt-1 font-heading text-2xl font-black">Set up guidance for {event.name}</h1>
              </div>
              <button type="button" onClick={dismissCreatedState} className="min-h-11 rounded-full px-3 text-sm font-bold text-slate-300 hover:bg-white/10">Dismiss</button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-200">You can invite the organizing team and founders now. Until the pitch standard is published, invited founders will see that preparation is underway and will wait to record.</p>
            {createdState.invited ? <p className="mt-2 text-sm text-slate-200">{createdState.invited} founder invite{createdState.invited === 1 ? '' : 's'} sent.</p> : null}
            {createdState.failed ? <p role="alert" className="mt-2 text-sm font-semibold text-amber-300">{createdState.failed} invite{createdState.failed === 1 ? '' : 's'} could not be sent. Retry below.</p> : null}
            {!hasFounderAccess ? (
              <form onSubmit={createFounderInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <label htmlFor="quick-founder-emails-input" className="sr-only">Founder emails</label>
                  <EmailChipInput
                    inputId="quick-founder-emails-input"
                    value={founderInviteEmails}
                    onChange={setFounderInviteEmails}
                    placeholder="founder@startup.com"
                  />
                </div>
                <button disabled={saving} className="cta-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-black disabled:opacity-60"><UserPlus className="h-4 w-4" />Send invites</button>
              </form>
            ) : (
              <Link href={`/events/${slug}`} className="cta-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black">View founder page</Link>
            )}
          </section>
        ) : null}

        <section aria-labelledby="action-dashboard-title" className="mb-5">
          <p className="text-sm font-semibold text-slate-400">Pitch day {formatDate(event.event_date)}</p>
          <h1 id="action-dashboard-title" className="mt-1 font-heading text-3xl font-black text-white sm:text-4xl">{event.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Guide founders from a first practice take to a sharper, event-ready pitch.</p>
          {!createdState.active ? (
            <div className="mt-4">
              {primaryAction.kind === 'review' && reviewNextHref ? (
                <Link href={reviewNextHref} className="cta-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-heading font-black sm:w-auto">{primaryAction.label}<ArrowRight className="h-5 w-5" /></Link>
              ) : (
                <button type="button" onClick={() => setDashboardView(primaryAction.tab, primaryAction.filter)} className="cta-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-heading font-black sm:w-auto">{primaryAction.label}<ArrowRight className="h-5 w-5" /></button>
              )}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {actionCounts.needsFeedback > 0 && primaryAction.kind !== 'review' ? <ActionCard icon={MessageSquareText} label="Needs feedback" value={actionCounts.needsFeedback} action="Review" urgent onClick={() => setDashboardView('submissions', 'needs-feedback')} /> : null}
            {actionCounts.notSubmitted > 0 && primaryAction.kind !== 'follow-up' ? <ActionCard icon={Clock3} label="Not submitted" value={actionCounts.notSubmitted} action="Open" urgent onClick={() => setDashboardView('founders', 'not-submitted')} /> : null}
            {actionCounts.notRecorded > 0 ? <ActionCard icon={Video} label="Not recorded" value={actionCounts.notRecorded} action="Open" onClick={() => setDashboardView('founders', 'not-recorded')} /> : null}
          </div>
          {activeFounderCount > 0 && activeReviewers < 2 ? (
            <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="reviewer-readiness-title">
              <div>
                <h2 id="reviewer-readiness-title" className="font-heading text-sm font-black text-amber-100">Reviewer coverage needs attention</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">{activeReviewers} active reviewer{activeReviewers === 1 ? '' : 's'} for {activeFounderCount} founder{activeFounderCount === 1 ? '' : 's'}. Plan enough capacity for two useful reviews per founder.</p>
              </div>
              <button type="button" onClick={() => setDashboardView('team')} className="btn-glass min-h-11 shrink-0 rounded-full px-4 text-sm font-black">Invite reviewers</button>
            </section>
          ) : null}
        </section>

        <div className="mt-5 flex flex-col gap-3">
          <div className="overflow-x-auto">
            <div role="tablist" aria-label="Event dashboard sections" className="inline-flex min-w-max gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {PERSISTENT_DASHBOARD_TABS.map((tab, index) => (
              <button
                key={tab}
                id={`dashboard-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`dashboard-panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => setDashboardView(tab)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`rounded-full px-4 py-2 text-sm font-black capitalize tracking-wide transition ${
                  activeTab === tab ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                  {DASHBOARD_TAB_LABELS[tab]}
              </button>
            ))}
            </div>
          </div>
          <nav aria-label="Event tools" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setDashboardView('overview'); window.setTimeout(() => document.getElementById('pitch-guidelines')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }} className="btn-glass inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold">Pitch guidelines</button>
            <button type="button" onClick={() => setDashboardView('team')} className="btn-glass min-h-11 rounded-full px-4 text-sm font-bold">Team</button>
            <button type="button" onClick={() => setDashboardView('announcements')} className="btn-glass min-h-11 rounded-full px-4 text-sm font-bold">Announcements</button>
            {state.canManageEvent ? <EventEditDialog event={event} onSaved={handleEventSaved} /> : null}
            {state.canManageEvent ? <Link href={`/events/${slug}/report`} className="btn-glass inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold">Outcome report</Link> : null}
            <Link href={`/events/${slug}`} className="btn-glass inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold">Founder view</Link>
            <button type="button" onClick={() => copyText(roomUrl, 'event')} className="btn-glass min-h-11 rounded-full px-4 text-sm font-bold">{copied === 'event' ? 'Founder link copied' : 'Copy founder link'}</button>
            {state.canManageEvent && submissions.length ? <button type="button" onClick={assignReviews} disabled={busyAction === 'assign-reviews'} className="btn-glass min-h-11 rounded-full px-4 text-sm font-bold disabled:opacity-50">{busyAction === 'assign-reviews' ? 'Assigning…' : 'Coordinate reviews'}</button> : null}
          </nav>
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

        {activeFilter ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
            <p className="text-sm font-bold text-slate-100">
              Filtered to {activeFilter.replaceAll('-', ' ')}.
            </p>
            <button type="button" onClick={() => setDashboardView(activeTab)} className="btn-glass inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold">
              Clear filter
            </button>
          </div>
        ) : null}

        <section
          id={`dashboard-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`dashboard-tab-${activeTab}`}
          tabIndex={0}
          className="mt-5 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        >
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {!createdState.active ? <PitchGuidelinesEditor eventSlug={slug} canManage={state.canManageEvent} /> : null}
              <div>
              <h2 className="font-heading text-2xl font-black">Founder progress</h2>
              <p className="mt-2 text-sm text-slate-400">{submittedCount} of {founderSummaries.length} founders submitted · {feedbackedCount} received feedback</p>
              {founderSummaries.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {founderSummaries.slice(0, 6).map((founder) => <FounderRow key={founder.participant.id} founder={founder} onViewDeck={viewFounderDeck} />)}
                </div>
              ) : (
                <button type="button" onClick={() => setDashboardView('founders')} className="cta-primary mt-4 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-black">Invite founders</button>
              )}
              </div>
            </div>
          )}

          {activeTab === 'founders' && (
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Invite founders" eyebrow={state.canManageEvent ? 'Founder access' : 'Read only'}>
                {state.canManageEvent ? (
                  <form onSubmit={createFounderInvite} className="space-y-4">
                    <div>
                      <label htmlFor="panel-founder-emails-input" className="mb-2 block text-sm font-bold text-slate-300">Founder emails</label>
                      <EmailChipInput
                        inputId="panel-founder-emails-input"
                        value={founderInviteEmails}
                        onChange={setFounderInviteEmails}
                        placeholder="founder@company.com"
                      />
                    </div>
                    <button
                      disabled={saving}
                      className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold disabled:opacity-60"
                    >
                      <UserPlus className="h-4 w-4" />
                      Send founder invites
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
                  {filteredFounders.map((founder) => (
                    <FounderRow
                      key={founder.participant.id}
                      founder={founder}
                      detailed
                      canManage={state.canManageEvent && founder.participant.user_id !== event.organizer_id}
                      busyAction={busyAction}
                      onUpdateParticipant={runParticipantMutation}
                      onViewDeck={viewFounderDeck}
                    />
                  ))}
                  {!filteredFounders.length && (
                    <EmptyState text={activeFilter ? 'No founders match this action. Clear the filter to view the full roster.' : 'No founders have joined this event yet.'} />
                  )}
                </div>
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Founder invites</p>
                  {founderInvitations.map((invite: any) => (
                    <InviteRow
                      key={invite.id}
                      invite={invite}
                      copied={copied}
                      onCopy={copyText}
                      canManage={state.canManageEvent}
                      busyAction={busyAction}
                      onResend={() => runInviteMutation(invite.id, 'resend')}
                      onRevoke={() => runInviteMutation(invite.id, 'revoke')}
                    />
                  ))}
                  {!founderInvitations.length && <EmptyState text="No founder invitations yet. Paste one or more emails to start the roster." />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'submissions' && (
            <Panel title="Submission review" eyebrow="Team visible">
              <p className="mb-4 text-sm text-slate-400">{sortedSubmissions.length} submitted · {actionCounts.needsFeedback} need feedback</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} eventSlug={slug} />
                ))}
                {!filteredSubmissions.length && (
                  <EmptyState text={activeFilter ? 'No submissions match this action. Clear the filter to view every final take.' : 'No final takes submitted yet.'} />
                )}
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
                        placeholder="coach@accelerator.org or leave blank for a copyable link"
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
                      copied={copied}
                      onCopy={copyText}
                      canManage={state.canManageEvent}
                      busyAction={busyAction}
                      onResend={() => runInviteMutation(invite.id, 'resend')}
                      onRevoke={() => runInviteMutation(invite.id, 'revoke')}
                    />
                  ))}
                  {!teamInvitations.length && <EmptyState text="No team invitations yet. Founder invites live in the Founders tab." />}
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

function SetupChecklist({
  event,
  hasFounderInvite,
  hasReviewerInvite,
  hasAnnouncement,
  onNavigate,
}: {
  event: any;
  hasFounderInvite: boolean;
  hasReviewerInvite: boolean;
  hasAnnouncement: boolean;
  onNavigate: (tab: DashboardTab) => void;
}) {
  const completeCount = [true, hasFounderInvite, hasReviewerInvite, hasAnnouncement].filter(Boolean).length;
  const items: Array<{
    label: string;
    complete: boolean;
    action?: string;
    tab?: DashboardTab;
    href?: string;
  }> = [
    { label: 'Create room', complete: true },
    { label: 'Invite founders', complete: hasFounderInvite, action: 'Invite', tab: 'founders' },
    { label: 'Invite judges or coaches', complete: hasReviewerInvite, action: 'Invite', tab: 'team' },
    { label: 'Preview founder experience', complete: false, action: 'Preview', href: `/events/${event.slug}` },
    { label: 'Send welcome announcement', complete: hasAnnouncement, action: 'Post', tab: 'announcements' },
  ];

  return (
    <section className="glass-card rounded-[2rem] p-5 sm:p-6" aria-labelledby="setup-checklist-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Room setup</p>
          <h2 id="setup-checklist-title" className="mt-2 font-heading text-2xl font-black text-white">Launch checklist</h2>
        </div>
        <p className="text-sm font-bold text-slate-400">{completeCount} of 4 trackable steps complete</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const content = (
            <>
              {item.complete ? <CheckCircle2 className="h-5 w-5 text-neon-lime" /> : <Circle className="h-5 w-5 text-slate-500" />}
              <span className="min-w-0 flex-1 font-heading text-sm font-bold text-white">{item.label}</span>
              {item.action ? <span className="text-xs font-black uppercase tracking-[0.1em] text-neon-cyan">{item.action}</span> : null}
            </>
          );

          if (item.href) {
            return <Link key={item.label} href={item.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-neon-cyan/40">{content}</Link>;
          }

          return (
            <button
              key={item.label}
              type="button"
              disabled={!item.tab}
              onClick={() => item.tab && onNavigate(item.tab)}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-neon-cyan/40 disabled:cursor-default disabled:hover:border-white/10"
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActionCard({
  icon: Icon,
  label,
  value,
  action,
  urgent,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  action: string;
  urgent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${value} ${label}. ${action}`}
      className={`group flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
        urgent ? 'border-roast/30 bg-roast/10 hover:border-roast/60' : 'border-white/10 bg-white/[0.04] hover:border-neon-cyan/40'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${urgent ? 'text-roast' : 'text-neon-cyan'}`} />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-xl font-black leading-tight text-white">{value}</p>
        <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
      </div>
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-300">{action}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
    </button>
  );
}

function InvitationHealthSummary({ invitations }: { invitations: any[] }) {
  const health = invitations.map((invitation) => getInvitationHealth(invitation));
  const items = [
    { label: 'Sent', value: health.filter((item) => item.delivery === 'sent').length },
    { label: 'Accepted', value: health.filter((item) => item.lifecycle === 'accepted').length },
    { label: 'Failed', value: health.filter((item) => item.delivery === 'failed').length },
    { label: 'Expired', value: health.filter((item) => item.lifecycle === 'expired').length },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
        {items.map((item) => <StatusTile key={item.label} label={item.label} value={item.value} />)}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Email opens are not measured by the current delivery provider integration.</p>
      {!invitations.length ? <div className="mt-3"><EmptyState text="No invitations yet. Invite founders or team members to begin tracking access." /></div> : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
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
  onViewDeck,
}: {
  founder: FounderSummary;
  detailed?: boolean;
  canManage?: boolean;
  busyAction?: string;
  onUpdateParticipant?: (participantId: string, patch: { role?: string; status?: 'active' | 'removed' }) => void;
  onViewDeck?: (userId: string) => void;
}) {
  const status = getFounderStatus(founder);
  const latestPitch = founder.latestPitch || founder.submittedPitch?.pitch || null;
  const displayName = participantDisplayName(founder.participant.profile);
  const participantActionBusy = busyAction === `participant:${founder.participant.id}`;
  const participantStatus = participantStatusLabel(founder.participant.status);
  const isRemoved = founder.participant.status === 'removed';

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start gap-3">
        <img
          src={founder.participant.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
          alt={displayName}
          className="h-11 w-11 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{displayName}</p>
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
        {founder.participant.deck && onViewDeck ? (
          <button
            type="button"
            onClick={() => onViewDeck(founder.participant.user_id)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-3.5 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/20"
            title={founder.participant.deck.kind === 'file' ? founder.participant.deck.fileName || 'Pitch deck' : `Deck link on ${founder.participant.deck.linkHost || 'the web'}`}
          >
            <FileText className="h-3.5 w-3.5" />
            View deck
          </button>
        ) : null}
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
  onRevoke,
}: {
  invite: any;
  copied: string;
  onCopy: (value: string, label: string) => void;
  canManage?: boolean;
  busyAction?: string;
  onResend?: () => void;
  onRevoke?: () => void;
}) {
  const link = invite.invite_url || '';
  const hasEmail = Boolean(invite.email);
  const health = getInvitationHealth(invite);
  const canCopy = health.lifecycle === 'pending' || health.lifecycle === 'expired';
  const resendBusy = busyAction === `invite:${invite.id}:resend`;
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
            {health.lifecycleLabel}
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
          disabled={!link || !canCopy}
          className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Copy className="h-4 w-4" />
          {copied === invite.id ? 'Copied' : 'Copy link'}
        </button>
        {canManage && onResend && hasEmail && health.canResend ? (
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
        {canManage && onRevoke && health.canRevoke ? (
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

function SubmissionCard({ submission, eventSlug }: { submission: any; eventSlug: string }) {
  const readiness = readinessFromFeedback(submission.pitch?.feedback || []);
  const displayName = participantDisplayName(submission.profile);
  const takeLabel = getTakeLabelFromFields(submission.pitch || {});
  const detailPath = pitchPath(submission.pitch?.public_id, submission.pitch_id) || '#';
  // Every entry into the pitch page from an event surface carries the event
  // context, so feedback scopes to the event even off the thumbnail link.
  const detailHref = detailPath === '#' ? '#' : `${detailPath}?event=${encodeURIComponent(eventSlug)}`;
  const feedbackHref = detailPath === '#'
    ? '#'
    : `${detailPath}?feedback=1&event=${encodeURIComponent(eventSlug)}`;

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-black/35">
      <Link href={detailHref} className="group relative block aspect-[9/16] bg-slate-950">
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
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{displayName}</p>
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
        <Link
          href={feedbackHref}
          aria-disabled={feedbackHref === '#' ? true : undefined}
          className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black ${feedbackHref === '#' ? 'pointer-events-none bg-white/5 text-slate-500' : 'cta-primary'}`}
        >
          Review and give feedback
        </Link>
      </div>
    </article>
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
    ...(coverage.peerReviewsCompleted ? [{ label: 'Peer reviews', value: coverage.peerReviewsCompleted }] : []),
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
    <div className="min-h-dvh bg-background text-white">
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
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-white">
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
