'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

const tabs = ['Practice', 'Feedback', 'Rooms'];

export default function TopNavBar() {
  const [activeTab, setActiveTab] = useState('Practice');

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/82 via-black/55 to-transparent">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Tabs */}
        <div className="flex flex-1 items-center gap-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative text-sm font-semibold text-white transition-opacity"
              style={{ opacity: activeTab === tab ? 1 : 0.7 }}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* Search Icon */}
        <button className="rounded-full border border-white/10 bg-white/10 p-2 text-white backdrop-blur-md">
          <Search size={20} />
        </button>
      </div>
    </div>
  );
}
