'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp } from 'lucide-react';
import { PitchCard } from '@/components/PitchCard';
import { mockPitches } from '@/lib/data';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-slate-100 leading-none">
                  Pitch in Public
                </h1>
                <p className="text-xs text-slate-400 font-body">
                  Where Founders Get Real
                </p>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-neon-cyan text-slate-900 rounded-lg font-heading font-bold text-sm hover:bg-neon-cyan/90 transition-colors"
            >
              Post Your Pitch
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-slate-100 mb-3 leading-tight">
            The <span className="text-neon-cyan">Stage</span>
          </h2>
          <p className="text-lg text-slate-400 font-body max-w-2xl">
            Real pitches from real founders. Watch, learn, and give feedback that matters.
          </p>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            <button className="px-4 py-2 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-full text-sm font-heading font-bold hover:bg-neon-cyan/20 transition-colors">
              <TrendingUp className="inline-block w-4 h-4 mr-1" />
              Trending
            </button>
            <button className="px-4 py-2 bg-slate-900/50 border border-slate-800 text-slate-300 rounded-full text-sm font-body hover:bg-slate-800 transition-colors">
              All Industries
            </button>
            <button className="px-4 py-2 bg-slate-900/50 border border-slate-800 text-slate-300 rounded-full text-sm font-body hover:bg-slate-800 transition-colors">
              All Stages
            </button>
          </div>
        </motion.div>

        {/* Pitch Grid - Desktop: Grid, Mobile: Vertical Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockPitches.map((pitch, index) => (
            <PitchCard key={pitch.id} pitch={pitch} index={index} />
          ))}
        </div>

        {/* Load More */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <button className="px-8 py-3 bg-slate-900/50 border border-slate-800 text-slate-300 rounded-lg font-heading font-bold hover:bg-slate-800 hover:border-neon-cyan/30 transition-all">
            Load More Pitches
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="mt-20 py-12 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm font-body">
            Built for founders who aren't afraid of feedback.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <a
              href="#"
              className="text-slate-400 hover:text-neon-cyan transition-colors text-sm font-body"
            >
              About
            </a>
            <span className="text-slate-700">•</span>
            <a
              href="#"
              className="text-slate-400 hover:text-neon-cyan transition-colors text-sm font-body"
            >
              Guidelines
            </a>
            <span className="text-slate-700">•</span>
            <a
              href="#"
              className="text-slate-400 hover:text-neon-cyan transition-colors text-sm font-body"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
