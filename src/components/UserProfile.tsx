'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Users, Video, TrendingUp, Clock, Flame } from 'lucide-react';
import { User, Pitch } from '@/types';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  userPitches: Pitch[];
}

type SortBy = 'latest' | 'oldest' | 'popular';

export function UserProfile({ isOpen, onClose, user, userPitches }: UserProfileProps) {
  const [sortBy, setSortBy] = useState<SortBy>('latest');

  const sortedPitches = [...userPitches].sort((a, b) => {
    switch (sortBy) {
      case 'latest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'popular':
        return (b.views + b.toastCount * 10) - (a.views + a.toastCount * 10);
      default:
        return 0;
    }
  });

  const handleLogout = () => {
    // In production, clear auth tokens and redirect
    console.log('Logging out...');
    alert('Logout functionality - would redirect to login page');
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90]"
          />

          {/* Panel - Right Side */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-slate-950 border-l border-slate-800 z-[100] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">Profile</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-start gap-4">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-20 h-20 rounded-full border-2 border-neon-cyan"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{user.name}</h3>
                  <p className="text-slate-400 text-sm">{user.email}</p>
                  {user.bio && (
                    <p className="text-slate-300 text-sm mt-2">{user.bio}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 mt-6">
                <div>
                  <div className="text-white font-bold text-lg">{formatNumber(user.followersCount)}</div>
                  <div className="text-slate-400 text-xs">Followers</div>
                </div>
                <div>
                  <div className="text-white font-bold text-lg">{formatNumber(user.followingCount)}</div>
                  <div className="text-slate-400 text-xs">Following</div>
                </div>
                <div>
                  <div className="text-white font-bold text-lg">{user.pitchesCount}</div>
                  <div className="text-slate-400 text-xs">Pitches</div>
                </div>
              </div>
            </div>

            {/* My Pitches Section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Video className="w-4 h-4 text-neon-cyan" />
                  My Pitches
                </h3>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-neon-cyan"
                >
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                  <option value="popular">Popular</option>
                </select>
              </div>

              {/* Pitch Grid */}
              {sortedPitches.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {sortedPitches.map((pitch) => (
                    <div
                      key={pitch.id}
                      className="relative aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden group cursor-pointer hover:ring-2 hover:ring-neon-cyan transition-all"
                    >
                      <img
                        src={pitch.thumbnailUrl}
                        alt={pitch.companyName}
                        className="w-full h-full object-cover"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-white text-xs font-semibold line-clamp-2 mb-1">
                            {pitch.companyName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-300">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {formatNumber(pitch.views)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-400" />
                              {pitch.interestScore}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Duration Badge */}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
                        {pitch.duration}s
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Video className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No pitches yet</p>
                  <p className="text-slate-600 text-xs mt-1">Post your first pitch to get started!</p>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div className="p-4 border-t border-slate-800 mt-auto">
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
