'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ClipboardCheck, Flame, PanelLeftClose, PanelLeftOpen, Plus, Trophy, UserRound, Video } from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from './BrandMark';

interface SidebarNavProps {
  onPostClick: () => void;
  isGuest?: boolean;
  onSignInClick?: () => void;
  guestActionLabel?: string;
  onChallengeClick?: () => void;
  canManageEvents?: boolean;
  reviewerMode?: boolean;
  canSwitchMode?: boolean;
  onModeChange?: (mode: 'founder' | 'reviewer') => void;
}

interface Streak {
  currentStreak: number;
  bestStreak: number;
  totalActivities: number;
  pitchReps?: number;
  isActiveToday: boolean;
  recentDays?: Array<{
    date: string;
    active: boolean;
    isToday: boolean;
  }>;
}

const SIDEBAR_COLLAPSED_KEY = 'pip.sidebarCollapsed';
const PITCH_CREATED_EVENT = 'pip:pitch-created';

function getSevenDayMomentum(streak: Streak) {
  if (streak.recentDays?.length === 7) {
    return streak.recentDays.map((day, index) => ({
      key: day.date || index,
      active: day.active,
      isToday: day.isToday,
      label: day.isToday ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
    }));
  }

  return Array.from({ length: 7 }, (_, index) => {
    const offsetFromToday = 6 - index;
    const active = streak.isActiveToday
      ? offsetFromToday < streak.currentStreak
      : offsetFromToday > 0 && offsetFromToday <= streak.currentStreak;
    const date = new Date();
    date.setDate(date.getDate() - offsetFromToday);

    return {
      key: index,
      active,
      isToday: offsetFromToday === 0,
      label: offsetFromToday === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' }),
    };
  });
}

export function SidebarNav({
  onPostClick,
  isGuest = false,
  onSignInClick,
  guestActionLabel = 'Log in',
  onChallengeClick,
  canManageEvents = false,
  reviewerMode = false,
  canSwitchMode = false,
  onModeChange,
}: SidebarNavProps) {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navItems = reviewerMode
    ? [{ label: 'Review feed', icon: ClipboardCheck, active: true }]
    : [
        { label: 'Practice', icon: Video, active: true },
        { label: 'My pitches', icon: UserRound, href: '/me' },
        { label: 'Pitch rooms', icon: CalendarDays, href: '/events' },
        { label: 'Leaderboard', icon: Trophy, href: '/leaderboard' },
      ];
  const organizerItems = canManageEvents && !reviewerMode
    ? [
        { label: 'My rooms', icon: CalendarDays, href: '/events' },
        { label: 'Create event', icon: CalendarDays, href: '/events/new' },
      ]
    : [];

  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  useEffect(() => {
    if (isGuest || reviewerMode) {
      setStreak(null);
      return;
    }

    let cancelled = false;

    const fetchStreak = async () => {
      try {
        const res = await fetch('/api/user/streak');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStreak(data.streak);
      } catch (error) {
        console.error('Error fetching sidebar streak:', error);
      }
    };

    fetchStreak();
    window.addEventListener(PITCH_CREATED_EVENT, fetchStreak);

    return () => {
      cancelled = true;
      window.removeEventListener(PITCH_CREATED_EVENT, fetchStreak);
    };
  }, [isGuest, reviewerMode]);

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-50 flex w-20 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(18,23,34,0.86),rgba(5,7,10,0.96))] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-2xl transition-[width] duration-300 ease-out ${
        isCollapsed ? 'lg:w-20' : 'lg:w-56'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 p-4 lg:py-6 ${isCollapsed ? 'lg:px-4' : 'lg:px-5'}`}>
        <Link href="/" className="min-w-0 flex-1">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <BrandMark className="h-10 w-10 flex-shrink-0" />
          <div className={`hidden min-w-0 lg:block ${isCollapsed ? 'lg:hidden' : ''}`}>
            <h1 className="text-lg font-heading font-bold text-white leading-none">
              Pitch in Public
            </h1>
            <p className="text-xs text-slate-400 font-body">
              {reviewerMode ? 'Trusted Reviewer' : 'For Founders'}
            </p>
          </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`btn-glass hidden h-9 w-9 shrink-0 items-center justify-center p-0 text-slate-300 hover:text-white lg:flex ${
            isCollapsed ? 'absolute -right-4 top-7' : ''
          }`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 px-2 py-5 ${isCollapsed ? 'lg:px-3' : 'lg:px-3'}`}>
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon className="h-6 w-6 flex-shrink-0" />
                <span className={`hidden lg:block ${isCollapsed ? 'lg:hidden' : ''} ${item.active ? 'font-heading font-bold' : 'font-body font-semibold'}`}>
                  {item.label}
                </span>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100 ${
                    isCollapsed ? 'lg:justify-center lg:px-3' : 'lg:px-4'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  {content}
                </Link>
              );
            }

            return (
              <motion.button
                key={item.label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                  isCollapsed ? 'lg:justify-center lg:px-3' : 'lg:px-4'
                } ${
                  item.active
                    ? 'glass-pill border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan'
                    : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {content}
              </motion.button>
            );
          })}
        </div>

        {organizerItems.length ? (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className={`mb-2 hidden px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 lg:block ${isCollapsed ? 'lg:hidden' : ''}`}>
              Organizer
            </p>
            <div className="space-y-2">
              {organizerItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100 ${
                      isCollapsed ? 'lg:justify-center lg:px-3' : 'lg:px-4'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-6 w-6 flex-shrink-0" />
                    <span className={`hidden font-body font-semibold lg:block ${isCollapsed ? 'lg:hidden' : ''}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Post Button */}
        {!reviewerMode ? (
          <motion.button
            onClick={onPostClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`cta-primary mt-6 flex w-full items-center justify-center gap-2 px-4 py-3.5 font-heading font-bold ${
              isCollapsed ? 'lg:px-3' : ''
            }`}
            title={isCollapsed ? 'Record Pitch' : undefined}
          >
            <Plus className="w-5 h-5" />
            <span className={`hidden lg:block ${isCollapsed ? 'lg:hidden' : ''}`}>Record Pitch</span>
          </motion.button>
        ) : null}

        {!isGuest && !reviewerMode && streak && !isCollapsed && (
          <div className="mt-6 hidden lg:block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
                    <Flame className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{streak.currentStreak || 0}d run</p>
                    <p className="text-xs text-slate-500">{streak.pitchReps ?? streak.totalActivities ?? 0} pitch reps</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onChallengeClick}
                  className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-neon-cyan/40 hover:text-white"
                >
                  Plan
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 rounded-2xl border border-white/[0.07] bg-black/20 p-2">
                {getSevenDayMomentum(streak).map((day) => (
                  <span
                    key={day.key}
                    className={`h-5 rounded-md border transition ${
                      day.active
                        ? day.isToday
                          ? 'border-neon-lime/35 bg-neon-lime/80 shadow-[0_0_14px_rgba(183,255,42,0.18)]'
                          : 'border-neon-cyan/20 bg-neon-cyan/45'
                        : day.isToday
                          ? 'border-white/20 bg-white/[0.08]'
                          : 'border-white/[0.05] bg-white/[0.04]'
                    }`}
                    title={day.active ? `${day.label}: pitch posted` : `${day.label}: no pitch posted`}
                    aria-label={day.active ? `${day.label}: pitch posted` : `${day.label}: no pitch posted`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom section - invite access for guests. Settings stays hidden until it is functional. */}
      <div className="border-t border-white/10 p-2 lg:p-4">
        {!isGuest && canSwitchMode ? (
          <button
            type="button"
            onClick={() => onModeChange?.(reviewerMode ? 'founder' : 'reviewer')}
            className={`mb-3 flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-sm font-bold text-slate-200 transition hover:border-neon-cyan/35 hover:text-white ${isCollapsed ? 'lg:px-2' : ''}`}
            title={reviewerMode ? 'Switch to founder mode' : 'Switch to reviewer mode'}
          >
            <span className={isCollapsed ? 'lg:hidden' : ''}>{reviewerMode ? 'Founder mode' : 'Reviewer mode'}</span>
            <span className={`hidden ${isCollapsed ? 'lg:block' : ''}`} aria-hidden="true">⇄</span>
          </button>
        ) : null}
        {isGuest ? (
          <>
            <motion.button
              onClick={onSignInClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`cta-primary mb-4 flex w-full items-center justify-center gap-2 px-4 py-3 font-heading font-bold ${
                isCollapsed ? 'lg:px-3' : ''
              }`}
              title={isCollapsed ? guestActionLabel : undefined}
            >
              <span className={`hidden lg:block ${isCollapsed ? 'lg:hidden' : ''}`}>{guestActionLabel}</span>
              <span className="lg:hidden">{guestActionLabel}</span>
            </motion.button>

            {/* Footer Links - Desktop Only */}
            <div className={`hidden space-y-3 text-xs lg:block ${isCollapsed ? 'lg:hidden' : ''}`}>
              {/* Company Section */}
              <div>
                <h4 className="text-slate-500 font-semibold mb-1">Company</h4>
                <div className="flex gap-3">
                  <Link href="/about" className="text-slate-400 hover:text-slate-300 transition-colors">
                    About
                  </Link>
                  <Link href="/contact" className="text-slate-400 hover:text-slate-300 transition-colors">
                    Contact
                  </Link>
                </div>
              </div>

              {/* Terms & Policies */}
              <div>
                <Link href="/terms" className="text-slate-400 hover:text-slate-300 transition-colors">
                  Terms & Policies
                </Link>
              </div>

              {/* Copyright */}
              <div className="text-slate-500 pt-2">
                © 2025 Pitch in Public
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
