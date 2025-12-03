/**
 * Gamification utilities and helper functions
 */

/**
 * Badge definitions with unlock conditions
 */
export const BADGES = {
  first_pitch: {
    id: 'first_pitch',
    name: 'First Pitch',
    description: 'Published your first pitch',
    icon: '🎬',
    condition: 'pitchesCount >= 1',
  },
  five_pitches: {
    id: 'five_pitches',
    name: 'Five-Time Pitcher',
    description: 'Published 5 pitches',
    icon: '5️⃣',
    condition: 'pitchesCount >= 5',
  },
  ten_pitches: {
    id: 'ten_pitches',
    name: 'Prolific Pitcher',
    description: 'Published 10 pitches',
    icon: '🔟',
    condition: 'pitchesCount >= 10',
  },
  five_day_streak: {
    id: 'five_day_streak',
    name: 'On Fire',
    description: 'Maintained a 5-day streak',
    icon: '🔥',
    condition: 'currentStreak >= 5',
  },
  ten_day_streak: {
    id: 'ten_day_streak',
    name: 'On a Roll',
    description: 'Maintained a 10-day streak',
    icon: '⚡',
    condition: 'currentStreak >= 10',
  },
  fifty_roasts: {
    id: 'fifty_roasts',
    name: 'Constructive Critic',
    description: 'Given 50 roasts',
    icon: '🔥',
    condition: 'roastsGiven >= 50',
  },
  fifty_toasts: {
    id: 'fifty_toasts',
    name: 'Cheerleader',
    description: 'Given 50 toasts',
    icon: '🥂',
    condition: 'toastsGiven >= 50',
  },
  feedback_expert: {
    id: 'feedback_expert',
    name: 'Feedback Expert',
    description: 'Submitted 25 detailed feedback responses',
    icon: '💡',
    condition: 'feedbacksGiven >= 25',
  },
};

/**
 * Check which badges should be unlocked based on user stats
 */
export function checkBadgesEligibility(stats: {
  pitchesCount: number;
  currentStreak: number;
  roastsGiven: number;
  toastsGiven: number;
  feedbacksGiven: number;
}): string[] {
  const eligible: string[] = [];

  // Check each badge condition
  if (stats.pitchesCount >= 1) eligible.push('first_pitch');
  if (stats.pitchesCount >= 5) eligible.push('five_pitches');
  if (stats.pitchesCount >= 10) eligible.push('ten_pitches');
  if (stats.currentStreak >= 5) eligible.push('five_day_streak');
  if (stats.currentStreak >= 10) eligible.push('ten_day_streak');
  if (stats.roastsGiven >= 50) eligible.push('fifty_roasts');
  if (stats.toastsGiven >= 50) eligible.push('fifty_toasts');
  if (stats.feedbacksGiven >= 25) eligible.push('feedback_expert');

  return eligible;
}

/**
 * Get badge icon for display
 */
export function getBadgeIcon(badgeId: string): string {
  return BADGES[badgeId as keyof typeof BADGES]?.icon || '🏆';
}

/**
 * Get badge name for display
 */
export function getBadgeName(badgeId: string): string {
  return BADGES[badgeId as keyof typeof BADGES]?.name || 'Unknown Badge';
}

/**
 * Format streak display
 */
export function formatStreak(days: number): string {
  if (days === 0) return 'No streak yet';
  if (days === 1) return '🔥 1 day';
  return `🔥 ${days} days`;
}

/**
 * Get streak milestone message
 */
export function getStreakMilestoneMessage(days: number): string {
  const milestones: Record<number, string> = {
    5: '🎉 5-day streak! Keep the momentum going!',
    10: '⚡ Amazing 10-day streak! You\'re on fire!',
    25: '🌟 Incredible 25-day streak! You\'re unstoppable!',
    50: '👑 Legendary 50-day streak! You\'re a champion!',
    100: '🏆 EPIC 100-day streak! You\'re a legend!',
  };

  return milestones[days] || '';
}

/**
 * Achievement unlock notification data
 */
export interface AchievementNotification {
  id: string;
  badgeId: string;
  badgeName: string;
  badgeIcon: string;
  description: string;
}

/**
 * Streak notification data
 */
export interface StreakNotification {
  currentStreak: number;
  bestStreak: number;
  isNewStreak: boolean;
  isMilestone: boolean;
  milestoneMessage?: string;
}
