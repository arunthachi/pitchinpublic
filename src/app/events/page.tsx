'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ActionPageNav } from '@/components/ActionPageNav';
import { destination } from '@/lib/app-navigation';
import {
  classifyEventRole,
  parseEventListView,
  type EventListView,
} from '@/lib/event-dashboard';

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

const VIEW_COPY: Record<EventListView, { title: string; empty: string }> = {
  joined: {
    title: 'Pitch rooms',
    empty: 'No pitch rooms yet. Open an event invite to join one.',
  },
  managed: {
    title: 'My events',
    empty: 'No events yet. Create one to invite founders.',
  },
  team: {
    title: 'Event workspaces',
    empty: 'No team workspaces yet.',
  },
};

function EventsContent() {
  const { user, loading, signOut } = useAuth();
  const searchParams = useSearchParams();
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
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load events.');
        if (!cancelled) {
          setEvents(data.events || []);
          setCanCreateEvents(Boolean(data.canCreateEvents));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load events.');
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    };

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const groupedEvents = useMemo<Record<EventListView, any[]>>(() => ({
    joined: events.filter((event) => classifyEventRole(getRole(event)) === 'joined'),
    managed: events.filter((event) => classifyEventRole(getRole(event)) === 'managed'),
    team: events.filter((event) => classifyEventRole(getRole(event)) === 'team'),
  }), [events]);

  const requestedView = parseEventListView(searchParams.toString());
  const requestedRaw = searchParams.get('view');
  const availableViews = useMemo<EventListView[]>(() => {
    const views: EventListView[] = ['joined'];
    if (canCreateEvents || groupedEvents.managed.length) views.push('managed');
    if (groupedEvents.team.length) views.push('team');
    return views;
  }, [canCreateEvents, groupedEvents.managed.length, groupedEvents.team.length]);
  const primaryView = requestedView && availableViews.includes(requestedView)
    ? requestedView
    : canCreateEvents && availableViews.includes('managed')
      ? 'managed'
      : availableViews[0];
  const viewNotice = requestedRaw && (!requestedView || !availableViews.includes(requestedView))
    ? 'That event view is not available for this account. Showing your available events instead.'
    : '';

  useEffect(() => {
    if (loading || isLoadingEvents || !user) return;
    const requestedId = window.location.hash.slice(1);
    const targetId = requestedId || `events-${primaryView}`;
    window.requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  }, [isLoadingEvents, loading, primaryView, user]);

  if (loading || isLoadingEvents) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-white">
        <section className="w-full max-w-xl text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-neon-cyan" />
          <h1 className="mt-4 font-heading text-4xl font-black">Sign in to see your events.</h1>
          <p className="mt-3 leading-7 text-slate-400">Joined pitch rooms and organizer events appear here.</p>
          <Link href="/" className="cta-primary mt-6 inline-flex min-h-11 items-center rounded-full px-6 py-3 font-heading font-bold">
            Go to feed
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-white">
      <ActionPageNav
        ariaLabel="Events navigation"
        links={[
          destination(primaryView === 'managed' ? 'myEvents' : primaryView === 'team' ? 'eventWorkspaces' : 'pitchRooms', true),
          destination('feed'),
          ...(primaryView === 'managed' && canCreateEvents ? [destination('createEvent')] : []),
        ]}
        account={{ email: user.email, profileHref: '/me', onSignOut: signOut }}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <header className="mb-6">
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">{VIEW_COPY[primaryView].title}</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-300">Open the event where you need to act.</p>
          {availableViews.length > 1 ? (
            <nav aria-label="Switch event view" className="mt-4 flex flex-wrap gap-2">
              {availableViews.map((view) => (
                <Link
                  key={view}
                  href={`/events?view=${view}#events-${view}`}
                  aria-current={view === primaryView ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${view === primaryView ? 'bg-white text-slate-950' : 'border border-white/10 text-slate-300 hover:bg-white/10'}`}
                >
                  {VIEW_COPY[view].title}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        {viewNotice ? <p role="status" className="mb-5 rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 px-4 py-3 text-sm text-slate-200">{viewNotice}</p> : null}
        {error ? <p className="mb-5 rounded-xl border border-roast/25 bg-roast/10 px-4 py-3 text-sm font-semibold text-roast">{error}</p> : null}

        <RoomSection
          id={`events-${primaryView}`}
          title={VIEW_COPY[primaryView].title}
          empty={VIEW_COPY[primaryView].empty}
          emptyAction={primaryView === 'managed' && canCreateEvents ? { href: '/events/new', label: 'Create event' } : undefined}
        >
          {groupedEvents[primaryView].map((event) => (
            <RoomCard
              key={event.id}
              event={event}
              actionHref={primaryView === 'joined' ? `/events/${event.slug}` : `/events/${event.slug}/dashboard`}
              actionLabel={primaryView === 'joined' ? 'Open room' : 'Open event'}
              showDeadline={primaryView === 'joined'}
            />
          ))}
        </RoomSection>
      </main>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-background text-white">Loading events...</div>}>
      <EventsContent />
    </Suspense>
  );
}

function RoomSection({ id, title, empty, emptyAction, children }: {
  id: string;
  title: string;
  empty: string;
  emptyAction?: { href: string; label: string };
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section id={id} aria-label={title} tabIndex={-1} className="scroll-mt-4 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
      <div className="grid gap-3 md:grid-cols-2">
        {hasChildren ? children : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
            <p>{empty}</p>
            {emptyAction ? <Link href={emptyAction.href} className="cta-primary mt-4 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold">{emptyAction.label}</Link> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function RoomCard({ event, actionHref, actionLabel, showDeadline = false }: {
  event: any;
  actionHref: string;
  actionLabel: string;
  showDeadline?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            <span>{getRole(event)}</span><span aria-hidden="true">·</span><span>{getStatus(event)}</span>
          </div>
          <h3 className="mt-2 truncate font-heading text-xl font-black text-white">{event.name}</h3>
          <p className="mt-2 text-sm text-slate-400">
            Pitch day {formatDate(event.event_date)}
            {showDeadline && event.submission_deadline ? ` · Due ${formatDate(event.submission_deadline)}` : ''}
          </p>
        </div>
        <Link href={actionHref} className="cta-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold">
          {actionLabel}<ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
