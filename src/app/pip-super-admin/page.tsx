'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Copy,
  Loader2,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { SignInModal } from '@/components/SignInModal';
import { useAuth } from '@/contexts/AuthContext';
import { readableEmailError } from '@/lib/email-errors';

type AdminOverview = {
  counts: {
    founders: number;
    organizers: number;
    events: number;
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
  const [inviteState, setInviteState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    organizationName: '',
    website: '',
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

  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteState('loading');
    setInviteMessage('');
    setLastInviteUrl('');

    try {
      const response = await fetch('/api/pip-super-admin/organizer-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not create organizer invite.');
      }

      setInviteState('success');
      setLastInviteUrl(data.inviteUrl);
      setInviteMessage(
        data.emailStatus === 'sent'
          ? 'Invite created and emailed.'
          : data.emailStatus === 'skipped'
            ? 'Invite created. Copy the link below.'
            : data.emailStatus === 'not_configured'
              ? 'Invite created, but email is not configured in this environment. Copy the link below.'
              : `Invite created, but email was not sent. ${data.emailError ? readableEmailError(data.emailError) : 'Copy the link below.'}`
      );
      setForm({ email: '', organizationName: '', website: '', expiresInDays: 30, sendEmail: true });
      await loadOverview();
    } catch (err) {
      setInviteState('error');
      setInviteMessage(err instanceof Error ? err.message : 'Could not create organizer invite.');
    }
  };

  const resendInvite = async (inviteId: string) => {
    setSendingInviteId(inviteId);
    setInviteMessage('');
    setLastInviteUrl('');

    try {
      const response = await fetch(`/api/pip-super-admin/organizer-invites/${inviteId}/send`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not send organizer invite email.');
      }

      setInviteState(data.emailStatus === 'sent' ? 'success' : 'error');
      setLastInviteUrl(data.inviteUrl || '');
      setInviteMessage(
        data.emailStatus === 'sent'
          ? 'Organizer invite email sent.'
          : data.emailStatus === 'not_configured'
            ? 'Email is not configured in this environment. Copy the invite link below.'
            : `Email was not sent. ${data.emailError ? readableEmailError(data.emailError) : 'Copy the invite link below.'}`
      );
      await loadOverview();
    } catch (err) {
      setInviteState('error');
      setInviteMessage(err instanceof Error ? err.message : 'Could not send organizer invite email.');
    } finally {
      setSendingInviteId(null);
    }
  };

  const topInvites = useMemo(() => overview?.organizerInvitations || [], [overview]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Loading admin...</div>;
  }

  if (isSignedOut) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-white">
        <section className="glass-panel max-w-xl rounded-[2rem] p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-neon-cyan" />
          <h1 className="mt-5 font-heading text-4xl font-black">Platform admin</h1>
          <p className="mt-3 text-slate-300">Sign in as a Pitch in Public super admin to manage organizer invites.</p>
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
            <p className="mt-2 text-slate-400">Organizer invites, founders, and pitch-room visibility.</p>
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
          <StatCard label="Pending invites" value={overview?.counts.pendingOrganizerInvites || 0} icon={Mail} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Lead requests" value={overview?.counts.leadRequests || 0} icon={Sparkles} />
          <StatCard label="Founder requests" value={overview?.leadMetrics?.founderRequests || 0} icon={Users} />
          <StatCard label="Organizer requests" value={overview?.leadMetrics?.organizerRequests || 0} icon={ShieldCheck} />
          <StatCard label="Confirmation emails" value={overview?.leadMetrics?.confirmationSent || 0} icon={Mail} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={createInvite} className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-lime">Organizer invite</p>
            <h2 className="mt-2 font-heading text-3xl font-black">Send invite</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">Organizer email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="input-dark"
                  placeholder="organizer@program.com"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">Organization</span>
                <input
                  value={form.organizationName}
                  onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
                  className="input-dark"
                  placeholder="Startup Westport"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">Website or LinkedIn</span>
                <input
                  value={form.website}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  className="input-dark"
                  placeholder="https://..."
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">Expires in days</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.expiresInDays}
                    onChange={(event) => setForm({ ...form, expiresInDays: Number(event.target.value) })}
                    className="input-dark"
                  />
                </label>
                <label className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.sendEmail}
                    onChange={(event) => setForm({ ...form, sendEmail: event.target.checked })}
                    className="h-5 w-5 accent-neon-cyan"
                  />
                  <span className="text-sm font-bold text-slate-200">Email invite</span>
                </label>
              </div>
              {inviteMessage ? (
                <p className={`rounded-2xl border p-3 text-sm ${inviteState === 'error' ? 'border-red-400/25 bg-red-500/10 text-red-200' : 'border-neon-cyan/20 bg-neon-cyan/10 text-slate-200'}`}>
                  {inviteMessage}
                </p>
              ) : null}
              {lastInviteUrl ? (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(lastInviteUrl)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left text-sm text-slate-300"
                >
                  <span className="truncate">{lastInviteUrl}</span>
                  <Copy className="h-4 w-4 shrink-0 text-neon-cyan" />
                </button>
              ) : null}
              <button disabled={inviteState === 'loading'} className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 font-heading font-black disabled:opacity-70">
                {inviteState === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                Create organizer invite
              </button>
            </div>
          </form>

          <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">Recent</p>
                <h2 className="mt-2 font-heading text-3xl font-black">Organizer invites</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {loadState === 'loading' && !overview ? <EmptyState text="Loading admin data..." /> : null}
              {topInvites.length ? topInvites.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-lg font-black">{invite.organization_name || invite.email}</p>
                      <p className="text-sm text-slate-400">{invite.email}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-200">
                      {invite.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${emailStatusClass(invite.email_status)}`}>
                      {formatEmailStatus(invite.email_status)}
                    </span>
                    {invite.email_sent_at ? (
                      <span className="text-xs text-slate-500">Sent {formatDate(invite.email_sent_at)}</span>
                    ) : null}
                  </div>
                  {invite.email_error ? (
                    <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                      {readableEmailError(invite.email_error)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-400">
                    <span className="truncate">{invite.invite_code}</span>
                    <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/organizer/invite?code=${invite.invite_code}`)} aria-label="Copy invite link">
                      <Copy className="h-4 w-4 text-neon-cyan" />
                    </button>
                  </div>
                  {invite.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={sendingInviteId === invite.id}
                      onClick={() => resendInvite(invite.id)}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      {sendingInviteId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-neon-cyan" />}
                      {invite.email_status === 'sent' ? 'Resend email' : 'Send email'}
                    </button>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">Created {formatDate(invite.created_at)} · Expires {formatDate(invite.expires_at)}</p>
                </div>
              )) : <EmptyState text="No organizer invites yet." />}
            </div>
          </section>
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
