'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  Loader2,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { SignInModal } from '@/components/SignInModal';
import { useAuth } from '@/contexts/AuthContext';
import { readableEmailError } from '@/lib/email-errors';

type AdminOverview = {
  counts: {
    founders: number;
    organizers: number;
    events: number;
    pendingFounderInvites: number;
    pendingOrganizerInvites: number;
    leadRequests: number;
  };
  founders: Array<{ id: string; email: string; full_name: string | null; created_at: string; pitches_count: number; companies_count: number }>;
  organizers: Array<{ id: string; email: string; full_name: string | null; created_at: string; roleCreatedAt: string; pitches_count: number; companies_count: number }>;
  organizerInvitations: Array<{
    id: string;
    email: string;
    organization_name: string | null;
    website: string | null;
    invite_code: string;
    status: string;
    email_status?: string | null;
    email_error?: string | null;
    email_sent_at?: string | null;
    created_at: string;
    expires_at: string | null;
    accepted_at: string | null;
  }>;
  founderInvitations: Array<{
    id: string;
    email: string;
    cohort: string | null;
    status: string;
    email_status?: string | null;
    email_error?: string | null;
    email_sent_at?: string | null;
    accepted_at: string | null;
    expires_at: string | null;
    created_at: string;
  }>;
  events: Array<{ id: string; name: string; slug: string; status: string; event_date: string; created_at: string }>;
  leads: Array<{
    id: string;
    type: string;
    email: string;
    name: string;
    website: string | null;
    source: string | null;
    status: string;
    notification_status: string;
    notification_error?: string | null;
    confirmation_status: string;
    confirmation_error?: string | null;
    created_at: string;
  }>;
  leadMetrics?: {
    total: number;
    founderRequests: number;
    organizerRequests: number;
    newRequests: number;
    reviewingRequests: number;
    approvedRequests: number;
    declinedRequests: number;
    confirmationSent: number;
    confirmationFailed: number;
    confirmationNotConfigured: number;
    confirmationSkipped: number;
    notificationSent: number;
    notificationFailed: number;
    notificationNotConfigured: number;
    notificationSkipped: number;
    topSources: Array<{ source: string; count: number }>;
  };
};

function formatDate(value?: string | null) {
  if (!value) return 'None';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="font-heading text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-neon-cyan" />
      </div>
      <p className="mt-4 font-heading text-4xl font-black text-white">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-400">{text}</p>;
}

function formatEmailStatus(status?: string | null) {
  switch (status) {
    case 'sent':
      return 'Email sent';
    case 'failed':
      return 'Email failed';
    case 'not_configured':
      return 'Email not configured';
    case 'skipped':
      return 'Email skipped';
    case 'unknown':
    case null:
    case undefined:
      return 'Email status unknown';
    default:
      return status.replaceAll('_', ' ');
  }
}

function emailStatusClass(status?: string | null) {
  if (status === 'sent') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'failed' || status === 'not_configured') return 'border-red-400/30 bg-red-500/10 text-red-200';
  return 'border-white/10 bg-white/8 text-slate-300';
}

function requestStatusClass(status?: string | null) {
  if (status === 'approved') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'reviewing') return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
  if (status === 'declined') return 'border-red-400/30 bg-red-500/10 text-red-200';
  return 'border-white/10 bg-white/8 text-slate-300';
}

function requestStatusLabel(status?: string | null) {
  if (!status) return 'unknown';
  return status.replaceAll('_', ' ');
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [inviteTab, setInviteTab] = useState<'founders' | 'organizers'>('founders');
  const [organizerInviteState, setOrganizerInviteState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [organizerInviteMessage, setOrganizerInviteMessage] = useState('');
  const [organizerInviteUrl, setOrganizerInviteUrl] = useState('');
  const [founderInviteState, setFounderInviteState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [founderInviteMessage, setFounderInviteMessage] = useState('');
  const [founderInviteUrl, setFounderInviteUrl] = useState('');
  const [founderActionId, setFounderActionId] = useState<string | null>(null);
  const [organizerActionId, setOrganizerActionId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState('');
  const [organizerForm, setOrganizerForm] = useState({
    email: '',
    organizationName: '',
    website: '',
    expiresInDays: 30,
    sendEmail: true,
  });
  const [founderForm, setFounderForm] = useState({
    email: '',
    cohort: '',
    expiresInDays: 30,
    sendEmail: true,
  });

  const isSignedOut = !loading && !user;

  const loadOverview = async () => {
    setLoadState('loading');
    setError('');

    try {
      const response = await fetch('/api/pip-super-admin/overview', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not load admin dashboard.');
      }

      setOverview(data);
      setLoadState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin dashboard.');
      setLoadState('error');
    }
  };

  useEffect(() => {
    if (loading || !user) return;
    loadOverview();
  }, [loading, user]);

  const copyInviteUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl((current) => current === url ? '' : current), 1800);
  };

  const createOrganizerInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setOrganizerInviteState('loading');
    setOrganizerInviteMessage('');
    setOrganizerInviteUrl('');

    try {
      const response = await fetch('/api/pip-super-admin/organizer-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(organizerForm),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not create organizer invite.');
      }

      setOrganizerInviteState('success');
      setOrganizerInviteUrl(data.inviteUrl);
      setOrganizerInviteMessage(
        data.emailStatus === 'sent'
          ? 'Invite created and emailed.'
          : data.emailStatus === 'skipped'
            ? 'Invite created. Copy the link below.'
            : data.emailStatus === 'not_configured'
              ? 'Invite created, but email is not configured in this environment. Copy the link below.'
              : `Invite created, but email was not sent. ${data.emailError ? readableEmailError(data.emailError) : 'Copy the link below.'}`
      );
      setOrganizerForm({ email: '', organizationName: '', website: '', expiresInDays: 30, sendEmail: true });
      await loadOverview();
    } catch (err) {
      setOrganizerInviteState('error');
      setOrganizerInviteMessage(err instanceof Error ? err.message : 'Could not create organizer invite.');
    }
  };

  const createFounderInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setFounderInviteState('loading');
    setFounderInviteMessage('');
    setFounderInviteUrl('');

    try {
      const response = await fetch('/api/pip-super-admin/founder-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(founderForm),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not create founder invite.');
      }

      setFounderInviteState('success');
      setFounderInviteUrl(data.inviteUrl || '');
      setFounderInviteMessage(
        data.emailStatus === 'sent'
          ? 'Founder invite created and emailed.'
          : data.emailStatus === 'not_configured'
            ? 'Invite created, but email is not configured. Copy the one-time link below.'
            : data.emailStatus === 'skipped'
              ? 'Invite created. Copy the one-time link below.'
              : `Invite created, but email was not sent. ${data.emailError ? readableEmailError(data.emailError) : 'Copy the one-time link below.'}`
      );
      setFounderForm({ email: '', cohort: '', expiresInDays: 30, sendEmail: true });
      await loadOverview();
    } catch (err) {
      setFounderInviteState('error');
      setFounderInviteMessage(err instanceof Error ? err.message : 'Could not create founder invite.');
    }
  };

  const resendOrganizerInvite = async (inviteId: string) => {
    setOrganizerActionId(inviteId);
    setOrganizerInviteMessage('');
    setOrganizerInviteUrl('');

    try {
      const response = await fetch(`/api/pip-super-admin/organizer-invites/${inviteId}/send`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not send organizer invite email.');
      }

      setOrganizerInviteState(data.emailStatus === 'sent' ? 'success' : 'error');
      setOrganizerInviteUrl(data.inviteUrl || '');
      setOrganizerInviteMessage(
        data.emailStatus === 'sent'
          ? 'Organizer invite email sent.'
          : data.emailStatus === 'not_configured'
            ? 'Email is not configured in this environment. Copy the invite link below.'
            : `Email was not sent. ${data.emailError ? readableEmailError(data.emailError) : 'Copy the invite link below.'}`
      );
      await loadOverview();
    } catch (err) {
      setOrganizerInviteState('error');
      setOrganizerInviteMessage(err instanceof Error ? err.message : 'Could not send organizer invite email.');
    } finally {
      setOrganizerActionId(null);
    }
  };

  const resendFounderInvite = async (inviteId: string) => {
    setFounderActionId(inviteId);
    setFounderInviteMessage('');
    setFounderInviteUrl('');

    try {
      const response = await fetch(`/api/pip-super-admin/founder-invites/${inviteId}/send`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not resend founder invite.');
      }

      setFounderInviteState(data.emailStatus === 'sent' ? 'success' : 'error');
      setFounderInviteUrl(data.inviteUrl || '');
      setFounderInviteMessage(
        data.emailStatus === 'sent'
          ? 'Founder invite email sent.'
          : `Email was not sent. ${data.emailError ? readableEmailError(data.emailError) : 'Try again later.'}`
      );
      await loadOverview();
    } catch (err) {
      setFounderInviteState('error');
      setFounderInviteMessage(err instanceof Error ? err.message : 'Could not resend founder invite.');
    } finally {
      setFounderActionId(null);
    }
  };

  const revokeFounderInvite = async (inviteId: string) => {
    setFounderActionId(inviteId);
    setFounderInviteMessage('');

    try {
      const response = await fetch(`/api/pip-super-admin/founder-invites/${inviteId}/revoke`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not revoke founder invite.');
      }

      setFounderInviteState('success');
      setFounderInviteMessage('Founder invite revoked.');
      setConfirmRevokeId(null);
      await loadOverview();
    } catch (err) {
      setFounderInviteState('error');
      setFounderInviteMessage(err instanceof Error ? err.message : 'Could not revoke founder invite.');
    } finally {
      setFounderActionId(null);
    }
  };

  const organizerInvites = useMemo(() => overview?.organizerInvitations || [], [overview]);
  const founderInvites = useMemo(() => overview?.founderInvitations || [], [overview]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Loading admin...</div>;
  }

  if (isSignedOut) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-white">
        <section className="glass-panel max-w-xl rounded-[2rem] p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-neon-cyan" />
          <h1 className="mt-5 font-heading text-4xl font-black">Platform admin</h1>
          <p className="mt-3 text-slate-300">Sign in as a Pitch in Public super admin to manage private founder and organizer access.</p>
          <button onClick={() => setShowSignIn(true)} className="cta-primary mt-7 rounded-full px-6 py-4 font-heading font-black">
            Sign in
          </button>
        </section>
        <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-heading text-xs font-black uppercase tracking-[0.22em] text-neon-cyan">Platform control</p>
            <h1 className="mt-2 font-heading text-4xl font-black sm:text-5xl">Super admin dashboard</h1>
            <p className="mt-2 text-slate-400">Founder access, organizer invites, and pitch-room visibility.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={loadOverview} className="btn-glass inline-flex items-center gap-2 rounded-full px-4 py-3 font-heading font-bold">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <Link href="/" className="btn-glass inline-flex items-center gap-2 rounded-full px-4 py-3 font-heading font-bold">
              Founder app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {error ? <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-red-200">{error}</p> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Founders" value={overview?.counts.founders || 0} icon={Users} />
          <StatCard label="Organizers" value={overview?.counts.organizers || 0} icon={ShieldCheck} />
          <StatCard label="Events" value={overview?.counts.events || 0} icon={CalendarDays} />
          <StatCard
            label="Pending invites"
            value={(overview?.counts.pendingFounderInvites || 0) + (overview?.counts.pendingOrganizerInvites || 0)}
            icon={Mail}
          />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Lead requests" value={overview?.counts.leadRequests || 0} icon={Sparkles} />
          <StatCard label="Founder requests" value={overview?.leadMetrics?.founderRequests || 0} icon={Users} />
          <StatCard label="Organizer requests" value={overview?.leadMetrics?.organizerRequests || 0} icon={ShieldCheck} />
          <StatCard label="Confirmation emails" value={overview?.leadMetrics?.confirmationSent || 0} icon={Mail} />
        </section>

        <section className="mt-6">
          <div className="inline-flex min-h-12 w-full rounded-full border border-white/10 bg-white/[0.04] p-1 sm:w-auto" role="tablist" aria-label="Invitation type">
            <button
              type="button"
              role="tab"
              aria-selected={inviteTab === 'founders'}
              onClick={() => setInviteTab('founders')}
              className={`min-h-11 flex-1 rounded-full px-5 text-sm font-black transition sm:flex-none ${inviteTab === 'founders' ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/[0.06]'}`}
            >
              Founder invites
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inviteTab === 'organizers'}
              onClick={() => setInviteTab('organizers')}
              className={`min-h-11 flex-1 rounded-full px-5 text-sm font-black transition sm:flex-none ${inviteTab === 'organizers' ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/[0.06]'}`}
            >
              Organizer invites
            </button>
          </div>

          {inviteTab === 'founders' ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" role="tabpanel">
              <form onSubmit={createFounderInvite} className="glass-panel rounded-[2rem] p-5 sm:p-6">
                <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-lime">Independent founder</p>
                <h2 className="mt-2 font-heading text-3xl font-black">Send founder invite</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Grant private access without adding the founder to an event.</p>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-200">Founder email</span>
                    <input
                      type="email"
                      value={founderForm.email}
                      onChange={(event) => setFounderForm({ ...founderForm, email: event.target.value })}
                      className="input-dark"
                      placeholder="founder@startup.com"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-200">Cohort or source <span className="font-normal text-slate-500">(optional)</span></span>
                    <input
                      value={founderForm.cohort}
                      onChange={(event) => setFounderForm({ ...founderForm, cohort: event.target.value })}
                      className="input-dark"
                      placeholder="Founding cohort"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-200">Expires in days</span>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={founderForm.expiresInDays}
                        onChange={(event) => setFounderForm({ ...founderForm, expiresInDays: Number(event.target.value) })}
                        className="input-dark"
                      />
                    </label>
                    <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={founderForm.sendEmail}
                        onChange={(event) => setFounderForm({ ...founderForm, sendEmail: event.target.checked })}
                        className="h-5 w-5 accent-neon-cyan"
                      />
                      <span className="text-sm font-bold text-slate-200">Send email</span>
                    </label>
                  </div>
                  <InviteNotice state={founderInviteState} message={founderInviteMessage} />
                  {founderInviteUrl ? <InviteUrl url={founderInviteUrl} copied={copiedUrl === founderInviteUrl} onCopy={copyInviteUrl} /> : null}
                  <button disabled={founderInviteState === 'loading'} className="cta-primary inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 py-4 font-heading font-black disabled:opacity-70">
                    {founderInviteState === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                    Send founder invite
                  </button>
                </div>
              </form>

              <InviteHistory title="Founder invites" empty="No founder invites yet.">
                {loadState === 'loading' && !overview ? <EmptyState text="Loading admin data..." /> : null}
                {founderInvites.length ? founderInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-heading text-lg font-black">{invite.email}</p>
                        <p className="mt-1 text-sm text-slate-400">{invite.cohort || 'Direct invite'}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-200">{invite.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${emailStatusClass(invite.email_status)}`}>{formatEmailStatus(invite.email_status)}</span>
                      <span className="text-xs text-slate-500">
                        {invite.accepted_at ? `Accepted ${formatDate(invite.accepted_at)}` : invite.email_sent_at ? `Sent ${formatDate(invite.email_sent_at)}` : `Created ${formatDate(invite.created_at)}`}
                      </span>
                    </div>
                    {invite.email_error ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">{readableEmailError(invite.email_error)}</p> : null}
                    <p className="mt-3 text-xs text-slate-500">Expires {formatDate(invite.expires_at)}</p>
                    {invite.status === 'pending' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={founderActionId === invite.id}
                          onClick={() => resendFounderInvite(invite.id)}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                        >
                          {founderActionId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-neon-cyan" />}
                          Resend
                        </button>
                        {confirmRevokeId === invite.id ? (
                          <div className="flex flex-wrap gap-2" role="group" aria-label={`Confirm revoking invite for ${invite.email}`}>
                            <button type="button" disabled={founderActionId === invite.id} onClick={() => revokeFounderInvite(invite.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-400/30 bg-red-500/15 px-4 text-sm font-bold text-red-100">
                              <Check className="h-4 w-4" /> Confirm revoke
                            </button>
                            <button type="button" onClick={() => setConfirmRevokeId(null)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-bold text-slate-200">
                              <X className="h-4 w-4" /> Cancel
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setConfirmRevokeId(invite.id)} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-bold text-slate-300 transition hover:border-red-400/30 hover:text-red-200">Revoke</button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )) : <EmptyState text="No founder invites yet." />}
              </InviteHistory>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" role="tabpanel">
              <form onSubmit={createOrganizerInvite} className="glass-panel rounded-[2rem] p-5 sm:p-6">
                <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-lime">Organizer invite</p>
                <h2 className="mt-2 font-heading text-3xl font-black">Send organizer invite</h2>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-200">Organizer email</span>
                    <input type="email" value={organizerForm.email} onChange={(event) => setOrganizerForm({ ...organizerForm, email: event.target.value })} className="input-dark" placeholder="organizer@program.com" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-200">Organization</span>
                    <input value={organizerForm.organizationName} onChange={(event) => setOrganizerForm({ ...organizerForm, organizationName: event.target.value })} className="input-dark" placeholder="Startup Westport" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-200">Website or LinkedIn</span>
                    <input value={organizerForm.website} onChange={(event) => setOrganizerForm({ ...organizerForm, website: event.target.value })} className="input-dark" placeholder="https://..." />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-200">Expires in days</span>
                      <input type="number" min={1} max={90} value={organizerForm.expiresInDays} onChange={(event) => setOrganizerForm({ ...organizerForm, expiresInDays: Number(event.target.value) })} className="input-dark" />
                    </label>
                    <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                      <input type="checkbox" checked={organizerForm.sendEmail} onChange={(event) => setOrganizerForm({ ...organizerForm, sendEmail: event.target.checked })} className="h-5 w-5 accent-neon-cyan" />
                      <span className="text-sm font-bold text-slate-200">Send email</span>
                    </label>
                  </div>
                  <InviteNotice state={organizerInviteState} message={organizerInviteMessage} />
                  {organizerInviteUrl ? <InviteUrl url={organizerInviteUrl} copied={copiedUrl === organizerInviteUrl} onCopy={copyInviteUrl} /> : null}
                  <button disabled={organizerInviteState === 'loading'} className="cta-primary inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 py-4 font-heading font-black disabled:opacity-70">
                    {organizerInviteState === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    Create organizer invite
                  </button>
                </div>
              </form>

              <InviteHistory title="Organizer invites" empty="No organizer invites yet.">
                {loadState === 'loading' && !overview ? <EmptyState text="Loading admin data..." /> : null}
                {organizerInvites.length ? organizerInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-heading text-lg font-black">{invite.organization_name || invite.email}</p><p className="truncate text-sm text-slate-400">{invite.email}</p></div>
                      <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-200">{invite.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${emailStatusClass(invite.email_status)}`}>{formatEmailStatus(invite.email_status)}</span>
                      {invite.email_sent_at ? <span className="text-xs text-slate-500">Sent {formatDate(invite.email_sent_at)}</span> : null}
                    </div>
                    {invite.email_error ? <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">{readableEmailError(invite.email_error)}</p> : null}
                    {invite.status === 'pending' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={organizerActionId === invite.id} onClick={() => resendOrganizerInvite(invite.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60">
                          {organizerActionId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-neon-cyan" />}
                          {invite.email_status === 'sent' ? 'Resend email' : 'Send email'}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyInviteUrl(`${window.location.origin}/organizer/invite?code=${invite.invite_code}`)}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-bold text-slate-300 transition hover:bg-white/[0.06]"
                        >
                          <Copy className="h-4 w-4 text-neon-cyan" /> Copy link
                        </button>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">Created {formatDate(invite.created_at)} · Expires {formatDate(invite.expires_at)}</p>
                  </div>
                )) : <EmptyState text="No organizer invites yet." />}
              </InviteHistory>
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Organizers">
            {overview?.organizers.length ? overview.organizers.map((organizer) => (
              <PersonRow key={organizer.id} name={organizer.full_name || organizer.email} email={organizer.email} meta={`Organizer since ${formatDate(organizer.roleCreatedAt)} · ${organizer.pitches_count || 0} pitches`} />
            )) : <EmptyState text="No accepted organizers yet." />}
          </Panel>
          <Panel title="Founders">
            {overview?.founders.length ? overview.founders.map((founder) => (
              <PersonRow key={founder.id} name={founder.full_name || founder.email} email={founder.email} meta={`${founder.pitches_count || 0} pitches · joined ${formatDate(founder.created_at)}`} />
            )) : <EmptyState text="No founders yet." />}
          </Panel>
          <Panel title="Events">
            {overview?.events.length ? overview.events.map((event) => (
              <PersonRow key={event.id} name={event.name} email={`/${event.slug}`} meta={`${event.status} · pitch day ${formatDate(event.event_date)}`} />
            )) : <EmptyState text="No events yet." />}
          </Panel>
          <Panel title="Access requests">
            {overview?.leadMetrics ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="New" value={overview.leadMetrics.newRequests} />
                  <MiniMetric label="Reviewing" value={overview.leadMetrics.reviewingRequests} />
                  <MiniMetric label="Approved" value={overview.leadMetrics.approvedRequests} />
                  <MiniMetric label="Declined" value={overview.leadMetrics.declinedRequests} />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Top sources</p>
                  <div className="mt-3 space-y-2">
                    {overview.leadMetrics.topSources.length ? overview.leadMetrics.topSources.map((source) => (
                      <div key={source.source} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                        <span className="truncate text-sm text-slate-200">{source.source}</span>
                        <span className="text-sm font-black text-neon-cyan">{source.count}</span>
                      </div>
                    )) : <p className="text-sm text-slate-500">No source data yet.</p>}
                  </div>
                </div>
              </div>
            ) : null}
            {overview?.leads.length ? overview.leads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            )) : <EmptyState text="No access requests yet." />}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function InviteNotice({
  state,
  message,
}: {
  state: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}) {
  if (!message) return null;

  return (
    <p
      aria-live="polite"
      className={`rounded-2xl border p-3 text-sm ${state === 'error' ? 'border-red-400/25 bg-red-500/10 text-red-200' : 'border-neon-cyan/20 bg-neon-cyan/10 text-slate-200'}`}
    >
      {message}
    </p>
  );
}

function InviteUrl({
  url,
  copied,
  onCopy,
}: {
  url: string;
  copied: boolean;
  onCopy: (url: string) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">One-time invite link</p>
      <button
        type="button"
        onClick={() => onCopy(url)}
        className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left text-sm text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon-cyan"
        aria-label="Copy invite link"
      >
        <span className="truncate">{url}</span>
        {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-300" /> : <Copy className="h-4 w-4 shrink-0 text-neon-cyan" />}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? 'Invite link copied.' : ''}</span>
    </div>
  );
}

function InviteHistory({
  title,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
      <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">Recent</p>
      <h2 className="mt-2 font-heading text-3xl font-black">{title}</h2>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
      <h2 className="font-heading text-2xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function PersonRow({ name, email, meta }: { name: string; email: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="font-heading text-lg font-black text-white">{name}</p>
      <p className="mt-1 truncate text-sm text-slate-400">{email}</p>
      <p className="mt-2 text-xs text-slate-500">{meta}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-heading text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function LeadRow({
  lead,
}: {
  lead: {
    id: string;
    type: string;
    email: string;
    name: string;
    website: string | null;
    source: string | null;
    status: string;
    notification_status: string;
    notification_error?: string | null;
    confirmation_status: string;
    confirmation_error?: string | null;
    created_at: string;
  };
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-lg font-black text-white">{lead.name}</p>
          <p className="mt-1 truncate text-sm text-slate-400">{lead.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${requestStatusClass(lead.status)}`}>
            {requestStatusLabel(lead.status)}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${lead.type === 'founder' ? 'border-neon-lime/25 bg-neon-lime/10 text-neon-lime' : 'border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan'}`}>
            {lead.type}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${emailStatusClass(lead.confirmation_status)}`}>
          Confirmation {lead.confirmation_status.replaceAll('_', ' ')}
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${emailStatusClass(lead.notification_status)}`}>
          Team {lead.notification_status.replaceAll('_', ' ')}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Source: {lead.source || 'unknown'} · {formatDate(lead.created_at)}
      </p>
      {lead.confirmation_error ? (
        <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Confirmation: {readableEmailError(lead.confirmation_error)}
        </p>
      ) : null}
      {lead.notification_error ? (
        <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          Team email: {readableEmailError(lead.notification_error)}
        </p>
      ) : null}
      {lead.website ? (
        <p className="mt-2 truncate text-xs text-slate-500">{lead.website}</p>
      ) : null}
    </div>
  );
}
