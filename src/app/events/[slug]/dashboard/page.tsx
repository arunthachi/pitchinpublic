'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  MessageSquareText,
  Play,
  Send,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { formatPitchLength } from '@/lib/duration';

const TEAM_ROLES = ['organizer', 'admin', 'coach', 'mentor', 'judge'];
const INVITE_ROLES = ['founder', 'admin', 'coach', 'mentor', 'judge'];
const TABS = ['overview', 'founders', 'submissions', 'team', 'announcements'] as const;

type Tab = (typeof TABS)[number];

function readinessFromSubmission(submission: any) {
  const feedback = submission.pitch?.feedback || [];
  if (!feedback.length) return 0;
  const values = feedback.map((item: any) => {
    try {
      const parsed = JSON.parse(item.content || '{}');
      return parsed.readiness || 2;
    } catch {
      return 2;
    }
  });
  return Math.round((values.reduce((sum: number, value: number) => sum + value, 0) / values.length) * 10) / 10;
}

function readinessLabel(value: number) {
  if (!value) return 'Needs signal';
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

function formatDate(value?: string) {
  if (!value) return 'Not set';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'coach') return 'Coach';
  if (role === 'mentor') return 'Mentor';
  if (role === 'judge') return 'Judge';
  if (role === 'organizer') return 'Organizer';
  return 'Founder';
}

export default function EventDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'founder' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', audience: 'all' });
  const [actionMessage, setActionMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/events/${slug}`);
    const data = await response.json();
    setState(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const event = state?.event;
  const participants = useMemo(() => state?.participants || [], [state?.participants]);
  const submissions = useMemo(() => state?.submissions || [], [state?.submissions]);
  const invitations = useMemo(() => state?.invitations || [], [state?.invitations]);
  const announcements = useMemo(() => state?.announcements || [], [state?.announcements]);
  const founderRows = participants.filter((item: any) => item.role === 'founder');
  const teamRows = participants.filter((item: any) => TEAM_ROLES.includes(item.role));
  const feedbackCount = submissions.reduce((sum: number, item: any) => sum + (item.pitch?.feedback?.length || 0), 0);
  const inviteUrl = typeof window !== 'undefined' && event ? `${window.location.origin}/events/${event.slug}` : '';
  const sortedSubmissions = useMemo(
    () => [...submissions].sort((a, b) => readinessFromSubmission(b) - readinessFromSubmission(a)),
    [submissions]
  );

  const founderProgress = useMemo(() => {
    const submittedByUser = new Set(submissions.map((item: any) => item.user_id));
    return founderRows.map((participant: any) => ({
      ...participant,
      hasSubmission: submittedByUser.has(participant.user_id),
      submission: submissions.find((item: any) => item.user_id === participant.user_id),
    }));
  }, [founderRows, submissions]);

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1600);
  };

  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionMessage('');
    const response = await fetch(`/api/events/${slug}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.success) {
      setActionMessage(data.error || 'Could not create invite.');
      return;
    }
    setInviteForm({ email: '', role: inviteForm.role });
    setActionMessage('Invite created. Copy the link and send it to the right person.');
    load();
  };

  const createAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionMessage('');
    const response = await fetch(`/api/events/${slug}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(announcementForm),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.success) {
      setActionMessage(data.error || 'Could not post announcement.');
      return;
    }
    setAnnouncementForm({ title: '', body: '', audience: 'all' });
    setActionMessage('Announcement posted.');
    load();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white">Loading room control...</div>;
  }

  if (!state?.success || !event) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white">Event not found.</div>;
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
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => copyText(inviteUrl, 'event')} className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-bold text-white">
                <Copy className="h-4 w-4" />
                {copied === 'event' ? 'Copied' : 'Copy founder link'}
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

        {actionMessage && <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">{actionMessage}</p>}

        <section className="mt-5">
          {activeTab === 'overview' && (
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Readiness snapshot" eyebrow="Overview">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusTile label="Joined founders" value={founderRows.length} />
                  <StatusTile label="Best takes" value={submissions.length} />
                  <StatusTile label="Need feedback" value={Math.max(0, submissions.filter((item: any) => !(item.pitch?.feedback?.length)).length)} />
                </div>
                <div className="mt-5 space-y-3">
                  {founderProgress.slice(0, 5).map((founder: any) => (
                    <FounderRow key={founder.id} founder={founder} />
                  ))}
                  {!founderProgress.length && <EmptyState text="No founders have joined yet. Create founder invites from the Team tab." />}
                </div>
              </Panel>

              <Panel title="Latest announcements" eyebrow="Comms">
                <AnnouncementList announcements={announcements.slice(0, 4)} />
              </Panel>
            </div>
          )}

          {activeTab === 'founders' && (
            <Panel title="Founder roster" eyebrow="Participants">
              <div className="grid gap-3 md:grid-cols-2">
                {founderProgress.map((founder: any) => (
                  <FounderRow key={founder.id} founder={founder} detailed />
                ))}
                {!founderProgress.length && <EmptyState text="No founders have joined this event yet." />}
              </div>
            </Panel>
          )}

          {activeTab === 'submissions' && (
            <Panel title="Submission review" eyebrow="Team visible">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedSubmissions.map((submission: any) => (
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
                        placeholder="founder@company.com"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-300">Role</span>
                      <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className="input-dark">
                        {INVITE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
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
                    <PersonCard key={member.id} person={member} role={member.role} />
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pending invites</p>
                  {invitations.map((invite: any) => {
                    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${event.slug}?invite=${invite.invite_code}`;
                    return (
                      <div key={invite.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{invite.email || `${roleLabel(invite.role)} invite`}</p>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{roleLabel(invite.role)} · {invite.status}</p>
                        </div>
                        <button onClick={() => copyText(link, invite.id)} className="btn-glass inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
                          <Copy className="h-4 w-4" />
                          {copied === invite.id ? 'Copied' : 'Copy link'}
                        </button>
                      </div>
                    );
                  })}
                  {!invitations.length && <EmptyState text="No tracked invites yet." />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Post announcement" eyebrow="Team comms">
                <form onSubmit={createAnnouncement} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Title</span>
                    <input
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="input-dark"
                      placeholder="This week: sharpen the ask"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Message</span>
                    <textarea
                      value={announcementForm.body}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                      className="input-dark min-h-32 resize-y"
                      placeholder="Record one new take by Friday. Ask for feedback on clarity and confidence."
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Audience</span>
                    <select
                      value={announcementForm.audience}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })}
                      className="input-dark"
                    >
                      <option value="all">Everyone</option>
                      <option value="founders">Founders</option>
                      <option value="team">Team only</option>
                    </select>
                  </label>
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

function FounderRow({ founder, detailed = false }: { founder: any; detailed?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <img
        src={founder.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
        alt={founder.profile?.full_name || 'Founder'}
        className="h-11 w-11 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-white">{founder.profile?.full_name || 'Founder'}</p>
        <p className="text-sm text-slate-400">{founder.hasSubmission ? 'Final take submitted' : 'No final take yet'}</p>
        {detailed && founder.profile?.linkedin_url && <p className="truncate text-xs text-slate-500">{founder.profile.linkedin_url}</p>}
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${founder.hasSubmission ? 'bg-neon-lime text-slate-950' : 'bg-white/10 text-slate-300'}`}>
        {founder.hasSubmission ? 'Ready' : 'Open'}
      </span>
    </div>
  );
}

function PersonCard({ person, role }: { person: any; role: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <img
        src={person.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
        alt={person.profile?.full_name || role}
        className="h-11 w-11 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-white">{person.profile?.full_name || roleLabel(role)}</p>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{roleLabel(role)}</p>
      </div>
      <CheckCircle2 className="h-5 w-5 text-neon-lime" />
    </div>
  );
}

function SubmissionCard({ submission }: { submission: any }) {
  const readiness = readinessFromSubmission(submission);

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-black/35">
      <Link href={`/pitch/${submission.pitch_id}`} className="group relative block aspect-[9/16] bg-slate-950">
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
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Toast" value={submission.pitch?.toast_count || 0} />
          <Mini label="Roast" value={submission.pitch?.roast_count || 0} />
          <Mini label="Notes" value={submission.pitch?.feedback?.length || 0} />
        </div>
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
                  {announcement.audience}
                </span>
              </div>
              <p className="mt-2 leading-6 text-slate-300">{announcement.body}</p>
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
