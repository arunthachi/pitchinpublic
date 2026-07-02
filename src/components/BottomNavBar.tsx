'use client';

import { BarChart3, MessageCircle, Trophy, User } from 'lucide-react';
import { useState } from 'react';

interface BottomNavBarProps {
  onCreateClick: () => void;
  onProfileClick: () => void;
  isGuest?: boolean;
}

export default function BottomNavBar({ onCreateClick, onProfileClick, isGuest = false }: BottomNavBarProps) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-xl">
      <div className="flex items-center justify-around px-2 py-2">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex flex-col items-center gap-1 px-4 py-1"
        >
          <BarChart3
            size={28}
            className={activeTab === 'home' ? 'text-white' : 'text-gray-400'}
          />
          <span className={`text-xs ${activeTab === 'home' ? 'text-white' : 'text-gray-400'}`}>
            Practice
          </span>
        </button>

        {/* Network */}
        <button
          onClick={() => setActiveTab('network')}
          className="flex flex-col items-center gap-1 px-4 py-1 relative"
        >
          <Trophy
            size={28}
            className={activeTab === 'network' ? 'text-white' : 'text-gray-400'}
          />
          {/* Notification badge */}
          <div className="absolute top-0 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            7
          </div>
          <span className={`text-xs ${activeTab === 'network' ? 'text-white' : 'text-gray-400'}`}>
            Streaks
          </span>
        </button>

        {/* Create Button (Center, prominent) */}
        <button
          onClick={onCreateClick}
          className="relative -mt-2"
        >
          <div className="flex h-12 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-lime shadow-[0_10px_28px_rgba(0,240,255,0.24)]">
            <div className="flex h-11 w-[52px] items-center justify-center rounded-[0.9rem] bg-black">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </button>

        {/* Inbox */}
        <button
          onClick={() => setActiveTab('inbox')}
          className="flex flex-col items-center gap-1 px-4 py-1"
        >
          <MessageCircle
            size={28}
            className={activeTab === 'inbox' ? 'text-white' : 'text-gray-400'}
            fill={activeTab === 'inbox' ? 'white' : 'none'}
          />
          <span className={`text-xs ${activeTab === 'inbox' ? 'text-white' : 'text-gray-400'}`}>
            Feedback
          </span>
        </button>

        {/* Profile */}
        <button
          onClick={() => {
            setActiveTab('profile');
            onProfileClick();
          }}
          className="flex flex-col items-center gap-1 px-4 py-1"
        >
          <User
            size={28}
            className={activeTab === 'profile' ? 'text-white' : 'text-gray-400'}
            fill={activeTab === 'profile' ? 'white' : 'none'}
          />
          <span className={`text-xs ${activeTab === 'profile' ? 'text-white' : 'text-gray-400'}`}>
            Profile
          </span>
        </button>
      </div>
    </div>
  );
}
