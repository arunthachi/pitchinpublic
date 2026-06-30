'use client';

import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, Zap } from 'lucide-react';
import { formatStreak } from '@/lib/gamification';

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Streak Card */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-roast/30 to-roast/10 flex items-center justify-center">
              <Flame className="w-6 h-6 text-roast" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {streak.currentStreak || 0}
              </h3>
              <p className="text-slate-400 text-xs">Day Streak</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs mb-1">Best</div>
            <div className="text-toast font-bold text-lg">{streak.bestStreak || 0}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Activities</span>
            <span className="text-white font-semibold">{streak.totalActivities}</span>
          </div>
          {streak.currentStreak > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-700 mt-3">
              <Zap className="w-4 h-4 text-neon-cyan" />
              <p className="text-sm text-neon-cyan font-semibold">
                Keep it up! One more day to extend your streak.
              </p>
            </div>
          )}
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
      {!streak.isActiveToday && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenChallenge}
          className="w-full px-4 py-3 bg-gradient-to-r from-neon-cyan/20 to-neon-lime/20 border border-neon-cyan/50 rounded-xl hover:border-neon-cyan transition-all text-white text-sm font-semibold text-center"
        >
          ⚡ Complete today&apos;s challenge
        </motion.button>
      )}
    </motion.div>
  );
}
