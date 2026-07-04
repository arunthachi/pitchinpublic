'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Flame, PanelLeftClose, PanelLeftOpen, Plus, Trophy, Video, Zap } from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from './BrandMark';

interface SidebarNavProps {
  onPostClick: () => void;
  isGuest?: boolean;
  onSignInClick?: () => void;
  guestActionLabel?: string;
  onChallengeClick?: () => void;
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

function buildSevenDayMomentum(streak: Streak) {
  if (streak.recentDays?.length === 7) {
    return streak.recentDays.map((day, index) => ({
      key: day.date || index,
      active: day.active,
      isToday: day.isToday,
    }));
  }

  return Array.from({ length: 7 }, (_, index) => {
    const offsetFromToday = 6 - index;
    const active = streak.isActiveToday
      ? offsetFromToday < streak.currentStreak
      : offsetFromToday > 0 && offsetFromToday <= streak.currentStreak;

    return {
      key: index,
      active,
      isToday: offsetFromToday === 0,
    };
  });
}

export function SidebarNav({
  onPostClick,
  isGuest = false,
  onSignInClick,
  guestActionLabel = 'Log in',
  onChallengeClick,
}: SidebarNavProps) {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navItems = [
    { label: 'Practice', icon: Video, active: true },
    { label: 'Pitch Sprint', icon: CalendarDays, href: '/events/new' },
    { label: 'Leaderboard', icon: Trophy, href: '/leaderboard' },
  ];

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
    if (isGuest) {
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

    return () => {
      cancelled = true;
    };
  }, [isGuest]);

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
            <p className="text-xs text-slate-400 font-body">For Founders</p>
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

        {/* Post Button */}
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

        {!isGuest && streak && !isCollapsed && (
          <div className="glass-card mt-6 hidden rounded-2xl p-3 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
                  <Flame className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Pitch Momentum</p>
                  <p className="text-xs text-slate-500">Run {streak.currentStreak || 0}d · Best {streak.bestStreak || 0}d</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400">{streak.pitchReps ?? streak.totalActivities ?? 0} reps</span>
            </div>

            <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last 7 days</span>
                <span className="text-[10px] font-bold text-neon-lime">{streak.currentStreak || 0}d run</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {buildSevenDayMomentum(streak).map((day) => (
                  <span
                    key={day.key}
                    className={`h-5 rounded-md border ${
                      day.active
                        ? day.isToday
                          ? 'border-neon-lime/40 bg-neon-lime shadow-[0_0_16px_rgba(183,255,42,0.22)]'
                          : 'border-neon-cyan/25 bg-neon-cyan/45'
                        : day.isToday
                          ? 'border-white/15 bg-white/[0.08]'
                          : 'border-white/[0.04] bg-white/[0.045]'
                    }`}
                    title={day.isToday ? 'Today' : 'Recent pitch momentum'}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onChallengeClick}
              className="btn-glass flex w-full items-center justify-center gap-2 border-neon-cyan/35 bg-gradient-to-r from-neon-cyan/15 to-neon-lime/10 px-3 py-2.5 text-sm font-bold text-white hover:border-neon-cyan/70"
            >
              <Zap className="h-4 w-4 text-neon-lime" />
              {streak.isActiveToday ? 'Open pitch goal' : 'Plan next pitch'}
            </button>
          </div>
        )}
      </nav>

      {/* Bottom section - waitlist access for guests. Settings stays hidden until it is functional. */}
      <div className="border-t border-white/10 p-2 lg:p-4">
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
