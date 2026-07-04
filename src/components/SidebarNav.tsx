'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Flame, Plus, Trophy, Video, Zap } from 'lucide-react';
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
  isActiveToday: boolean;
}

export function SidebarNav({
  onPostClick,
  isGuest = false,
  onSignInClick,
  guestActionLabel = 'Log in',
  onChallengeClick,
}: SidebarNavProps) {
  const [streak, setStreak] = useState<Streak | null>(null);
  const navItems = [
    { label: 'Practice', icon: Video, active: true },
    { label: 'Pitch Sprint', icon: CalendarDays, href: '/events/new' },
    { label: 'Leaderboard', icon: Trophy, href: '/leaderboard' },
  ];

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
    <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-20 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(18,23,34,0.86),rgba(5,7,10,0.96))] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-2xl lg:w-56">
      {/* Logo */}
      <Link href="/" className="p-4 lg:px-5 lg:py-6">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10 flex-shrink-0" />
          <div className="hidden lg:block">
            <h1 className="text-lg font-heading font-bold text-white leading-none">
              Pitch in Public
            </h1>
            <p className="text-xs text-slate-400 font-body">For Founders</p>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-5 lg:px-3">
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon className="h-6 w-6 flex-shrink-0" />
                <span className={`hidden lg:block ${item.active ? 'font-heading font-bold' : 'font-body font-semibold'}`}>
                  {item.label}
                </span>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100 lg:px-4"
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
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-colors lg:px-4 ${
                  item.active
                    ? 'glass-pill border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan'
                    : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100'
                }`}
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
          className="cta-primary mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-heading font-bold"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden lg:block">Record Pitch</span>
        </motion.button>

        {!isGuest && streak && (
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
              <span className="text-xs font-semibold text-slate-400">{streak.totalActivities || 0} reps</span>
            </div>

            <button
              type="button"
              onClick={onChallengeClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neon-cyan/35 bg-gradient-to-r from-neon-cyan/15 to-neon-lime/10 px-3 py-2.5 text-sm font-bold text-white transition hover:border-neon-cyan/70"
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
              className="cta-primary mb-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-heading font-bold"
            >
              <span className="hidden lg:block">{guestActionLabel}</span>
              <span className="lg:hidden">{guestActionLabel}</span>
            </motion.button>

            {/* Footer Links - Desktop Only */}
            <div className="hidden lg:block space-y-3 text-xs">
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
