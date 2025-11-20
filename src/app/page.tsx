'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import { FullScreenVideoFeed } from '@/components/FullScreenVideoFeed';
import { RecordingStudio } from '@/components/RecordingStudio';
import { mockPitches } from '@/lib/data';

export default function Home() {
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);

  return (
    <>
      {/* Minimal Floating Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none"
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto">
          {/* Logo */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-lg font-heading font-bold text-white hidden sm:block">
              Pitch in Public
            </span>
          </motion.div>

          {/* Post Button */}
          <motion.button
            onClick={() => setRecordingStudioOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center shadow-lg hover:shadow-neon-cyan/50 transition-shadow"
          >
            <Plus className="w-6 h-6 text-slate-900" />
          </motion.button>
        </div>
      </motion.header>

      {/* Full-Screen Video Feed */}
      <FullScreenVideoFeed pitches={mockPitches} />

      {/* Recording Studio Modal */}
      <RecordingStudio
        isOpen={recordingStudioOpen}
        onClose={() => setRecordingStudioOpen(false)}
      />

      {/* Swipe Instruction (shows briefly on first load) */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 3, duration: 1 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      >
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
          <p className="text-xs text-white font-body">
            Swipe up/down or use arrow keys
          </p>
        </div>
      </motion.div>
    </>
  );
}
