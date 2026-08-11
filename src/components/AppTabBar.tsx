'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, User, Video } from 'lucide-react';
import {
  APP_MODE_KEY,
  APP_TAB_BAR_TABS,
  navBadgeLabel,
  type AppTabKey,
} from '@/lib/app-navigation';

type AppTabBarProps = {
  active?: AppTabKey;
  eventsBadge?: boolean;
};

const ICONS = {
  feed: Video,
  events: Calendar,
  profile: User,
} as const;

/**
 * Route-based sibling of the home screen's BottomNavBar. The home bar drives
 * in-page modals through callbacks, so it cannot be reused on routed pages —
 * without this the app shell vanished on /events and every action page read as
 * a detached browser page rather than a tab of the app.
 */
export default function AppTabBar({ active, eventsBadge = false }: AppTabBarProps) {
  // The home screen hides its equivalent bar entirely in reviewer mode. A judge
  // offered a Record tab hits a dead end: the ?record=1 handler short-circuits
  // on reviewer mode, so the studio never opens. Read the same persisted mode
  // the home shell writes. Starts false so the common founder case renders the
  // full bar on the first paint rather than flashing a missing tab.
  const [reviewerMode, setReviewerMode] = useState(false);

  useEffect(() => {
    try {
      setReviewerMode(window.localStorage.getItem(APP_MODE_KEY) === 'reviewer');
    } catch {
      // Private-mode storage denial just leaves the founder-shaped default.
    }
  }, []);

  const tabs = reviewerMode
    ? APP_TAB_BAR_TABS.filter((tab) => tab.key !== 'record')
    : APP_TAB_BAR_TABS;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[linear-gradient(180deg,rgba(18,23,34,0.86),rgba(5,7,10,0.96))] shadow-[0_-18px_50px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:hidden"
    >
      <div className="flex items-center justify-around px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        {tabs.map((tab) => {
          if (tab.key === 'record') {
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-label={tab.label}
                className="relative -mt-2 flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                <div className="cta-primary flex h-12 w-14 items-center justify-center rounded-2xl">
                  <div className="flex h-11 w-[52px] items-center justify-center rounded-[0.9rem] bg-graphite-dark/90">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white">
                  Record
                </span>
              </Link>
            );
          }

          const Icon = ICONS[tab.key];
          const isActive = active === tab.key;
          const showBadge = tab.key === 'events' && eventsBadge;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={navBadgeLabel(tab.label, showBadge)}
              className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              <span className="relative">
                <Icon
                  size={26}
                  className={isActive ? 'text-white' : 'text-gray-400'}
                  aria-hidden="true"
                />
                {showBadge ? (
                  <span
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-neon-lime"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <span className={`text-xs ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {tab.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
