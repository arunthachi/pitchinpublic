'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Trophy, Video } from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from './BrandMark';

interface SidebarNavProps {
  onPostClick: () => void;
  isGuest?: boolean;
  onSignInClick?: () => void;
  guestActionLabel?: string;
}

export function SidebarNav({
  onPostClick,
  isGuest = false,
  onSignInClick,
  guestActionLabel = 'Log in',
}: SidebarNavProps) {
  const navItems = [
    { label: 'Practice', icon: Video, active: true },
    { label: 'Leaderboard', icon: Trophy, href: '/leaderboard' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 flex w-20 flex-col border-r border-white/10 bg-black lg:w-56">
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
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 lg:px-4"
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
                    ? 'border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
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
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-3.5 font-heading font-bold text-slate-950 shadow-[0_16px_40px_rgba(0,240,255,0.18)]"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden lg:block">Record Pitch</span>
        </motion.button>
      </nav>

      {/* Bottom section - waitlist access for guests. Settings stays hidden until it is functional. */}
      <div className="border-t border-white/10 p-2 lg:p-4">
        {isGuest ? (
          <>
            <motion.button
              onClick={onSignInClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-heading font-bold mb-4"
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
