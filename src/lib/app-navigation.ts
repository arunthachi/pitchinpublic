export const APP_DESTINATIONS = {
  feed: { label: 'Feed', href: '/' },
  myPitches: { label: 'My pitches', href: '/me' },
  events: { label: 'Events', href: '/events' },
  pitchRooms: { label: 'Pitch rooms', href: '/events?view=joined#events-joined' },
  myEvents: { label: 'My events', href: '/events?view=managed#events-managed' },
  eventWorkspaces: { label: 'Event workspaces', href: '/events?view=team#events-team' },
  createEvent: { label: 'Create event', href: '/events/new' },
} as const;

export type AppDestinationKey = keyof typeof APP_DESTINATIONS;

export type ActionNavLink = {
  label: string;
  href: string;
  current?: boolean;
};

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
