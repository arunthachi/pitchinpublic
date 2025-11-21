'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

const tabs = ['LIVE', 'Explore', 'Following', 'For You'];

export default function TopNavBar() {
  const [activeTab, setActiveTab] = useState('For You');

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Tabs */}
        <div className="flex items-center gap-4 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative text-white font-medium text-sm transition-opacity"
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
        <button className="text-white p-2">
          <Search size={24} />
        </button>
      </div>
    </div>
  );
}
