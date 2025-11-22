'use client';

import { Home, Users, MessageCircle, User } from 'lucide-react';
import { useState } from 'react';

interface BottomNavBarProps {
  onCreateClick: () => void;
  onProfileClick: () => void;
  isGuest?: boolean;
}

export default function BottomNavBar({ onCreateClick, onProfileClick, isGuest = false }: BottomNavBarProps) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10">
      <div className="flex items-center justify-around px-2 py-2">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex flex-col items-center gap-1 px-4 py-1"
        >
          <Home
            size={28}
            className={activeTab === 'home' ? 'text-white' : 'text-gray-400'}
            fill={activeTab === 'home' ? 'white' : 'none'}
          />
          <span className={`text-xs ${activeTab === 'home' ? 'text-white' : 'text-gray-400'}`}>
            Home
          </span>
        </button>

        {/* Network */}
        <button
          onClick={() => setActiveTab('network')}
          className="flex flex-col items-center gap-1 px-4 py-1 relative"
        >
          <Users
            size={28}
            className={activeTab === 'network' ? 'text-white' : 'text-gray-400'}
          />
          {/* Notification badge */}
          <div className="absolute top-0 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            7
          </div>
          <span className={`text-xs ${activeTab === 'network' ? 'text-white' : 'text-gray-400'}`}>
            Network
          </span>
        </button>

        {/* Create Button (Center, prominent) */}
        <button
          onClick={onCreateClick}
          className="relative -mt-2"
        >
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-lime flex items-center justify-center">
            <div className="w-11 h-11 bg-black rounded-lg flex items-center justify-center">
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
            Inbox
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
