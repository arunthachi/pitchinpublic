'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, Zap, Target, Medal } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatar: string | null;
  currentStreak: number;
  bestStreak: number;
  pitchesCount: number;
  badgeCount: number;
  totalActivities: number;
  isCurrentUser: boolean;
}

type LeaderboardType = 'streaks' | 'pitches' | 'feedback' | 'badges';

// Memoized entry row component
interface LeaderboardEntryRowProps {
  entry: LeaderboardEntry;
  index: number;
  leaderboardType: LeaderboardType;
  getMetricDisplay: (entry: LeaderboardEntry) => React.ReactNode;
  getMedalIcon: (rank: number) => string | null;
}

const LeaderboardEntryRow = memo(function LeaderboardEntryRow({
  entry,
  index,
  getMetricDisplay,
  getMedalIcon,
}: LeaderboardEntryRowProps) {
  return (
    <motion.div
      key={`${entry.userId}-${entry.rank}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 sm:p-6 flex items-center justify-between gap-4 hover:bg-slate-800/50 transition-colors ${
        entry.isCurrentUser ? 'bg-neon-cyan/10 border-l-4 border-neon-cyan' : ''
      }`}
    >
      {/* Rank */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold">
          {getMedalIcon(entry.rank) || (
            <span className="text-slate-300">{entry.rank}</span>
          )}
        </div>

        {/* Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-slate-600">
          {entry.avatar ? (
            <img
              src={entry.avatar}
              alt={entry.userName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center text-slate-900 font-bold">
              {entry.userName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white truncate">{entry.userName}</h3>
          {entry.isCurrentUser && (
            <span className="px-2 py-1 bg-neon-cyan/20 text-neon-cyan text-xs font-bold rounded-full flex-shrink-0">
              YOU
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {entry.badgeCount} badges • {entry.pitchesCount} pitches
        </p>
      </div>

      {/* Metric */}
      <div className="flex-shrink-0 text-right">{getMetricDisplay(entry)}</div>
    </motion.div>
  );
});

export function Leaderboard() {
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('streaks');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/leaderboard?type=${leaderboardType}&limit=${limit}&offset=${page * limit}`
        );
        if (response.ok) {
          const data = await response.json();
          setEntries(data.leaderboard);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [leaderboardType, page]);

  const getMetricDisplay = useCallback((entry: LeaderboardEntry) => {
    switch (leaderboardType) {
      case 'streaks':
        return (
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-roast" />
            <span className="font-bold text-white">{entry.currentStreak}</span>
            <span className="text-xs text-slate-400">days</span>
          </div>
        );
      case 'pitches':
        return (
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-neon-cyan" />
            <span className="font-bold text-white">{entry.pitchesCount}</span>
            <span className="text-xs text-slate-400">pitches</span>
          </div>
        );
      case 'feedback':
        return (
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-lime" />
            <span className="font-bold text-white">{entry.totalActivities}</span>
            <span className="text-xs text-slate-400">activities</span>
          </div>
        );
      case 'badges':
        return (
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="font-bold text-white">{entry.badgeCount}</span>
            <span className="text-xs text-slate-400">badges</span>
          </div>
        );
    }
  }, [leaderboardType]);

  const getMedalIcon = useCallback((rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">🏆 Leaderboard</h1>
        <p className="text-slate-400">See how you rank against the community</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
        {(
          [
            { type: 'streaks' as const, label: '🔥 Streaks', icon: Flame },
            { type: 'pitches' as const, label: '🎬 Pitches', icon: Target },
            { type: 'feedback' as const, label: '⚡ Activity', icon: Zap },
            { type: 'badges' as const, label: '🏅 Badges', icon: Trophy },
          ] as const
        ).map((tab) => (
          <button
            key={tab.type}
            onClick={() => {
              setLeaderboardType(tab.type);
              setPage(0);
            }}
            className={`px-4 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
              leaderboardType === tab.type
                ? 'bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-600 border-t-neon-cyan rounded-full animate-spin mx-auto mb-4" />
            Loading leaderboard...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No entries yet</div>
        ) : (
          <div className="divide-y divide-slate-700">
            <AnimatePresence>
              {entries.map((entry, index) => (
                <LeaderboardEntryRow
                  key={`${entry.userId}-${entry.rank}`}
                  entry={entry}
                  index={index}
                  leaderboardType={leaderboardType}
                  getMetricDisplay={getMetricDisplay}
                  getMedalIcon={getMedalIcon}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && entries.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            ← Previous
          </button>

          <span className="text-slate-400 text-sm">
            Page {page + 1}
          </span>

          <button
            onClick={() => setPage(page + 1)}
            disabled={entries.length < limit}
            className="px-4 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
