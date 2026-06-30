'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Home, Compass, Users, TrendingUp, Settings, Plus, Sparkles, Search } from 'lucide-react';
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
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-black border-r border-slate-800 z-50 flex flex-col">
      {/* Logo */}
      <Link href="/" className="p-4 lg:p-6">
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
      <div className="px-2 lg:px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search"
            className="w-full bg-slate-800/50 border border-slate-700 rounded-full py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 font-body focus:outline-none focus:border-slate-600 focus:bg-slate-800 transition-colors hidden lg:block"
          />
          {/* Icon-only search button for mobile */}
          <button className="lg:hidden w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors">
            <Search className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 lg:px-4 py-4">
        <div className="space-y-2">
          {/* For You */}
          <motion.button
            onClick={isGuest && onSignInClick ? onSignInClick : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg bg-slate-900/50 border border-neon-cyan/30 text-neon-cyan"
          >
            <Home className="w-6 h-6 flex-shrink-0" />
            <span className="hidden lg:block font-heading font-bold">For You</span>
          </motion.button>

          {/* Following */}
          <motion.button
            onClick={isGuest && onSignInClick ? onSignInClick : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Users className="w-6 h-6 flex-shrink-0" />
            <span className="hidden lg:block font-body">Following</span>
          </motion.button>

          {/* Explore */}
          <motion.button
            onClick={isGuest && onSignInClick ? onSignInClick : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Compass className="w-6 h-6 flex-shrink-0" />
            <span className="hidden lg:block font-body">Explore</span>
          </motion.button>

          {/* Trending */}
          <motion.button
            onClick={isGuest && onSignInClick ? onSignInClick : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <TrendingUp className="w-6 h-6 flex-shrink-0" />
            <span className="hidden lg:block font-body">Trending</span>
          </motion.button>
        </div>

        {/* Post Button */}
        <motion.button
          onClick={onPostClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-heading font-bold"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden lg:block">Post Pitch</span>
        </motion.button>
      </nav>

      {/* Bottom section - Log in for guests, Settings for authenticated */}
      <div className="p-2 lg:p-4 border-t border-slate-800">
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
