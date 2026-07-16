'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ExternalLink, Plus, Sparkles, Trophy, Users, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPitchLength } from '@/lib/duration';

const TEAM_ROLES = new Set(['organizer', 'admin', 'coach', 'mentor', 'judge']);

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRole(event: any) {
  const participant = Array.isArray(event.pitch_event_participants) ? event.pitch_event_participants[0] : null;
  return participant?.role || 'founder';
}

function getStatus(event: any) {
  const participant = Array.isArray(event.pitch_event_participants) ? event.pitch_event_participants[0] : null;
  return participant?.status || event.status || 'active';
}

export default function EventsPage() {
  const { user, loading } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [canCreateEvents, setCanCreateEvents] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setEvents([]);
      setCanCreateEvents(false);
      setIsLoadingEvents(false);
      return;
    }

    let cancelled = false;

    const loadEvents = async () => {
      setIsLoadingEvents(true);
      setError('');
      try {
        const response = await fetch('/api/events');
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load pitch rooms.');
        if (!cancelled) {
          setEvents(data.events || []);
          setCanCreateEvents(Boolean(data.canCreateEvents));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load pitch rooms.');
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    };

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const managedRooms = useMemo(() => events.filter((event) => TEAM_ROLES.has(getRole(event))), [events]);
  const founderRooms = useMemo(() => events.filter((event) => getRole(event) === 'founder'), [events]);

  if (loading || isLoadingEvents) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-white">
        <section className="glass-panel w-full max-w-xl rounded-[2rem] p-6 text-center sm:p-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
            <CalendarDays className="h-8 w-8" />
          </div>
          <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-neon-lime">Pitch rooms</p>
          <h1 className="mt-3 font-heading text-4xl font-black">Sign in to see your event rooms.</h1>
          <p className="mt-3 leading-7 text-slate-400">
            Founder invites and organizer rooms appear here after you sign in with the invited email.
          </p>
          <Link href="/" className="cta-primary mt-6 inline-flex rounded-full px-6 py-3 font-heading font-bold">
            Go to sign in
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
              <Sparkles className="h-4 w-4" />
              Rooms
            </div>
            <h1 className="font-heading text-5xl font-black leading-tight">Your pitch rooms</h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-300">
              Event invites, final-take submissions, and organizer dashboards live here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="btn-glass inline-flex items-center justify-center rounded-full px-5 py-3 font-heading font-bold">
              Founder app
            </Link>
            {canCreateEvents ? (
              <Link href="/events/new" className="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading font-black">
                <Plus className="h-4 w-4" />
                Create event
              </Link>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-5 rounded-2xl border border-roast/25 bg-roast/10 px-4 py-3 text-sm font-semibold text-roast">{error}</p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <RoomSection title="Founder rooms" eyebrow="Submit and practice" empty="No founder rooms yet. Open an invite link from an organizer to join one.">
            {founderRooms.map((event) => (
              <RoomCard key={event.id} event={event} actionHref={`/events/${event.slug}`} actionLabel="Open room" />
            ))}
          </RoomSection>

          <RoomSection
            title="Organizer rooms"
            eyebrow="Manage events"
            empty={canCreateEvents ? 'No organizer rooms yet. Create your first pitch room to invite founders.' : 'No organizer rooms yet. Organizer access is invite-only.'}
            emptyAction={canCreateEvents ? { href: '/events/new', label: 'Create event' } : undefined}
          >
            {managedRooms.map((event) => (
              <RoomCard key={event.id} event={event} actionHref={`/events/${event.slug}/dashboard`} actionLabel="Open dashboard" team />
            ))}
          </RoomSection>
        </div>
      </main>
    </div>
  );
}

function RoomSection({
  eyebrow,
  title,
  empty,
  emptyAction,
  children,
}: {
  eyebrow: string;
  title: string;
  empty: string;
  emptyAction?: { href: string; label: string };
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="glass-card rounded-[2rem] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-3xl font-black">{title}</h2>
      <div className="mt-5 space-y-3">
        {hasChildren ? (
          children
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-400">
            <p>{empty}</p>
            {emptyAction ? (
              <Link href={emptyAction.href} className="cta-primary mt-4 inline-flex rounded-full px-4 py-2.5 font-heading text-sm font-bold">
                {emptyAction.label}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function RoomCard({ event, actionHref, actionLabel, team = false }: { event: any; actionHref: string; actionLabel: string; team?: boolean }) {
  const role = getRole(event);
  const status = getStatus(event);

  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
              {role}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
              {status}
            </span>
          </div>
          <h3 className="truncate font-heading text-2xl font-black text-white">{event.name}</h3>
          {event.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{event.description}</p> : null}
        </div>
        <Link href={actionHref} className="cta-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-heading font-bold">
          {actionLabel}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Mini icon={CalendarDays} label="Pitch day" value={formatDate(event.event_date)} />
        <Mini icon={Video} label="Length" value={formatPitchLength(event.pitch_length_seconds)} />
        <Mini icon={team ? Users : Trophy} label={team ? 'Mode' : 'Deadline'} value={team ? 'Team' : formatDate(event.submission_deadline)} />
      </div>
    </article>
  );
}

function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <Icon className="mb-2 h-4 w-4 text-neon-cyan" />
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
