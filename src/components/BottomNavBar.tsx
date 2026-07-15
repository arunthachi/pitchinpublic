'use client';

import { Trophy, User, Video } from 'lucide-react';
import { useState } from 'react';

interface BottomNavBarProps {
  onCreateClick: () => void;
  onProfileClick: () => void;
  onChallengeClick?: () => void;
  isGuest?: boolean;
}

export default function BottomNavBar({ onCreateClick, onProfileClick, onChallengeClick, isGuest = false }: BottomNavBarProps) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[linear-gradient(180deg,rgba(18,23,34,0.86),rgba(5,7,10,0.96))] shadow-[0_-18px_50px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
      <div className="flex items-center justify-around px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex flex-col items-center gap-1 px-4 py-1"
        >
          <Video
            size={28}
            className={activeTab === 'home' ? 'text-white' : 'text-gray-400'}
          />
          <span className={`text-xs ${activeTab === 'home' ? 'text-white' : 'text-gray-400'}`}>
            Practice
          </span>
        </button>

        {/* Create Button (Center, prominent) */}
        <button
          onClick={onCreateClick}
          className="relative -mt-2 flex flex-col items-center gap-1 px-2 py-1"
          aria-label="Record pitch"
          title="Record pitch"
        >
          <div className="cta-primary flex h-12 w-14 items-center justify-center rounded-2xl">
            <div className="flex h-11 w-[52px] items-center justify-center rounded-[0.9rem] bg-graphite-dark/90">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white">Record</span>
        </button>

        {/* Challenge */}
        <button
          onClick={() => {
            setActiveTab('challenge');
            onChallengeClick?.();
          }}
          className="flex flex-col items-center gap-1 px-2 py-1"
        >
          <Trophy
            size={26}
            className={activeTab === 'challenge' ? 'text-neon-lime' : 'text-gray-400'}
          />
          <span className={`text-xs ${activeTab === 'challenge' ? 'text-white' : 'text-gray-400'}`}>
            Goal
          </span>
        </button>

        {/* Profile */}
        <button
          onClick={() => {
            setActiveTab('profile');
            onProfileClick();
          }}
          className="flex flex-col items-center gap-1 px-2 py-1"
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
