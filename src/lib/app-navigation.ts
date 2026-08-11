export const APP_DESTINATIONS = {
  feed: { label: 'Feed', href: '/' },
  myPitches: { label: 'My pitches', href: '/me' },
  events: { label: 'Events', href: '/events' },
  pitchRooms: { label: 'Events', href: '/events?view=joined#events-joined' },
  myEvents: { label: 'My events', href: '/events?view=managed#events-managed' },
  eventWorkspaces: { label: 'Event workspaces', href: '/events?view=team#events-team' },
  createEvent: { label: 'Create event', href: '/events/new' },
} as const;

export type AppDestinationKey = keyof typeof APP_DESTINATIONS;

/**
 * localStorage key holding the founder/reviewer app mode. Shared so routed
 * surfaces can respect the mode the home shell persists.
 */
export const APP_MODE_KEY = 'pip.appMode';

/** Where the close control on every action page returns the user. */
export const APP_HOME_HREF = APP_DESTINATIONS.feed.href;

export type AppTabKey = 'feed' | 'events' | 'record' | 'profile';

export type AppTab = {
  key: AppTabKey;
  label: string;
  shortLabel: string;
  href: string;
};

/**
 * Tabs for the routed bottom bar. `record` deep-links into the home screen's
 * recorder via the existing `?record=1` handler rather than duplicating it.
 */
export const APP_TAB_BAR_TABS: readonly AppTab[] = [
  { key: 'feed', label: 'Practice feed', shortLabel: 'Practice', href: '/' },
  { key: 'events', label: 'Events', shortLabel: 'Events', href: '/events' },
  { key: 'record', label: 'Record pitch', shortLabel: 'Record', href: '/?record=1' },
  { key: 'profile', label: 'Profile', shortLabel: 'Profile', href: '/me' },
] as const;

export type ActionNavLink = {
  label: string;
  href: string;
  current?: boolean;
};

/**
 * The accessible name for a nav control that can carry the invitation badge.
 *
 * An `aria-label` on an element REPLACES its descendant text for assistive
 * tech, so an `sr-only` span nested inside a labelled link or button is never
 * announced. The badge state therefore has to live in the label itself.
 * SidebarNav is the exception — its anchor has no aria-label, so the nested
 * text is its accessible name and is read normally.
 */
export function navBadgeLabel(baseLabel: string, hasBadge: boolean) {
  return hasBadge ? `${baseLabel}, new invitation` : baseLabel;
}

export function destination(key: AppDestinationKey, current = false): ActionNavLink {
  return { ...APP_DESTINATIONS[key], current };
}

export function profileNavigationLinks(isOwnProfile: boolean): ActionNavLink[] {
  return isOwnProfile
    ? [destination('feed'), destination('myPitches', true), destination('events')]
    : [destination('feed')];
}

export function eventDashboardDestination(slug: string, current = false): ActionNavLink {
  return {
    label: 'Dashboard',
    href: `/events/${encodeURIComponent(slug)}/dashboard`,
    current,
  };
}

export function eventDestination(slug: string, current = false): ActionNavLink {
  return {
    label: 'Event',
    href: `/events/${encodeURIComponent(slug)}`,
    current,
  };
}
