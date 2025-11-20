'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SidebarNav } from '@/components/SidebarNav';
import { FullScreenVideoFeed } from '@/components/FullScreenVideoFeed';
import { RecordingStudio } from '@/components/RecordingStudio';
import { mockPitches } from '@/lib/data';

export default function Home() {
  const [recordingStudioOpen, setRecordingStudioOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-black">
      {/* Left Sidebar Navigation */}
      <SidebarNav onPostClick={() => setRecordingStudioOpen(true)} />

      {/* Main Content Area - Video Feed */}
      <main className="flex-1 ml-20 lg:ml-64">
        {/* Video Feed Container */}
        <div className="relative h-screen max-w-[600px] mx-auto bg-black">
          <FullScreenVideoFeed pitches={mockPitches} />
        </div>
      </main>

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
    </div>
  );
}
