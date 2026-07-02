'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, MessageSquareText, Settings, Plus, Sparkles, Search, Trophy, Video, Users } from 'lucide-react';
import Link from 'next/link';

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
    { label: 'Feedback', icon: MessageSquareText },
    { label: 'Rooms', icon: Users },
    { label: 'Leaderboard', icon: Trophy },
    { label: 'My Pitches', icon: BarChart3 },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 flex w-20 flex-col border-r border-white/10 bg-black lg:w-56">
      {/* Logo */}
      <Link href="/" className="p-4 lg:px-5 lg:py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-slate-900" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-heading font-bold text-white leading-none">
              Pitch in Public
            </h1>
            <p className="text-xs text-slate-400 font-body">For Founders</p>
          </div>
        </div>
      </Link>

      {/* Search Box */}
      <div className="px-2 pb-4 lg:px-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Find pitches"
            className="hidden w-full rounded-full border border-white/10 bg-white/[0.06] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-neon-cyan/45 focus:bg-white/[0.08] focus:outline-none lg:block"
          />
          {/* Icon-only search button for mobile */}
          <button className="lg:hidden w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors">
            <Search className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 lg:px-3">
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                onClick={!item.active && isGuest && onSignInClick ? onSignInClick : undefined}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-colors lg:px-4 ${
                  item.active
                    ? 'border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
              >
                <Icon className="h-6 w-6 flex-shrink-0" />
                <span className={`hidden lg:block ${item.active ? 'font-heading font-bold' : 'font-body'}`}>
                  {item.label}
                </span>
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

      {/* Bottom section - Log in for guests, Settings for authenticated */}
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
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Settings className="w-6 h-6 flex-shrink-0" />
            <span className="hidden lg:block font-body">Settings</span>
          </motion.button>
        )}
      </div>
    </aside>
  );
}
