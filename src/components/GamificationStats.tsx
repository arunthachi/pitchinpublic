'use client';

import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Gauge, Repeat2, Trophy, Zap } from 'lucide-react';

interface Streak {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
  totalActivities: number;
  isActiveToday: boolean;
}

interface Achievement {
  id: string;
  badgeId: string;
  badgeName: string;
  badgeIcon: string;
  unlockedAt: string;
}

interface GamificationStatsProps {
  onOpenChallenge?: () => void;
}

// Memoized badge item component
interface BadgeItemProps {
  achievement: Achievement;
  index: number;
}

const BadgeItem = memo(function BadgeItem({ achievement, index }: BadgeItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center border border-slate-600 hover:border-neon-lime/50 transition-all cursor-help group relative">
        <span className="text-lg">{achievement.badgeIcon}</span>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          {achievement.badgeName}
        </div>
      </div>
    </motion.div>
  );
});

export function GamificationStats({ onOpenChallenge }: GamificationStatsProps) {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch streak
        const streakRes = await fetch('/api/user/streak');
        if (streakRes.ok) {
          const data = await streakRes.json();
          setStreak(data.streak);
        }

        // Fetch achievements
        const achievRes = await fetch('/api/user/achievements');
        if (achievRes.ok) {
          const data = await achievRes.json();
          setAchievements(data.achievements);
        }
      } catch (error) {
        console.error('Error fetching gamification stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading || !streak) {
    return null;
  }

  const momentumScore = Math.min(
    100,
    (streak.currentStreak || 0) * 12 + (streak.totalActivities || 0) * 3 + (streak.isActiveToday ? 10 : 0)
  );
  const loopLabel = streak.isActiveToday ? 'Loop closed today' : 'One rep unlocks today';
  const momentumTone = momentumScore >= 70 ? 'text-neon-lime' : momentumScore >= 35 ? 'text-neon-cyan' : 'text-slate-300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Momentum Card */}
      <div className="overflow-hidden rounded-2xl border border-neon-cyan/20 bg-[radial-gradient(circle_at_20%_0%,rgba(0,240,255,0.16),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.95))] p-5 backdrop-blur-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neon-cyan/25 bg-neon-cyan/10">
              <Gauge className="h-6 w-6 text-neon-cyan" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-neon-cyan">Pitch Momentum</p>
              <h3 className={`text-3xl font-black ${momentumTone}`}>{momentumScore}</h3>
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs mb-1">Status</div>
            <div className="text-sm font-bold text-white">{loopLabel}</div>
          </div>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${momentumScore}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-roast">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Run</span>
            </div>
            <p className="text-xl font-black text-white">{streak.currentStreak || 0}d</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-neon-lime">
              <Repeat2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Reps</span>
            </div>
            <p className="text-xl font-black text-white">{streak.totalActivities || 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-toast">
              <Trophy className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Best</span>
            </div>
            <p className="text-xl font-black text-white">{streak.bestStreak || 0}d</p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-neon-lime" />
          <p className="text-sm leading-5 text-slate-300">
            The goal is not a streak. It is one sharper pitch loop: record, get feedback, improve.
          </p>
        </div>
      </div>

      {/* Achievements Card */}
      {achievements.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-neon-lime" />
            <h3 className="text-white font-bold">Badges ({achievements.length})</h3>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {achievements.slice(0, 8).map((achievement, index) => (
              <BadgeItem key={achievement.id} achievement={achievement} index={index} />
            ))}
          </div>

          {achievements.length > 8 && (
            <p className="text-xs text-slate-400 mt-3 text-center">
              +{achievements.length - 8} more badges
            </p>
          )}
        </div>
      )}

      {/* Challenge Reminder */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onOpenChallenge}
        className="w-full rounded-xl border border-neon-cyan/50 bg-gradient-to-r from-neon-cyan/20 to-neon-lime/20 px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:border-neon-cyan"
      >
        {streak.isActiveToday ? 'Review today’s challenge' : 'Complete today’s challenge'}
      </motion.button>
    </motion.div>
  );
}
