'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Flame, Wine, Share2, Plus, Bookmark, MessageSquareText } from 'lucide-react';
import { LegacyPitch } from '@/types';
import { formatNumber } from '@/lib/utils';

// Roast emoji for filled state
const RoastEmoji = ({ className }: any) => (
  <span className={className} style={{ lineHeight: 1 }}>🔥</span>
);

// Toast emoji for filled state
const ToastEmoji = ({ className }: any) => (
  <span className={className} style={{ lineHeight: 1 }}>🥂</span>
);

interface FloatingReactionsProps {
  pitch: LegacyPitch;
  onRoast: () => void;
  onToast: () => void;
  onOpenFeedback: (type: 'roast' | 'toast') => void;
  onOpenFeedbackList?: () => void;
  onShare: () => void;
  onBookmark?: (isBookmarked: boolean) => boolean | void | Promise<boolean | void>;
  isGuest?: boolean;
  onSignInClick?: () => void;
  isBookmarked?: boolean;
  bookmarkCount?: number;
  userReaction?: 'roast' | 'toast' | null;
}

export function FloatingReactions({
  pitch,
  onRoast,
  onToast,
  onOpenFeedback,
  onOpenFeedbackList,
  onShare,
  onBookmark,
  isGuest = false,
  onSignInClick,
  isBookmarked = false,
  bookmarkCount = 0,
  userReaction = null,
}: FloatingReactionsProps) {
  const router = useRouter();
  const [justRoasted, setJustRoasted] = useState(false);
  const [justToasted, setJustToasted] = useState(false);
  const [bookmarkState, setBookmarkState] = useState(isBookmarked);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);

  React.useEffect(() => {
    setBookmarkState(isBookmarked);
  }, [isBookmarked, pitch.id]);

  // Fetch follow status on mount
  React.useEffect(() => {
    const fetchFollowStatus = async () => {
      try {
        console.log(`Fetching follow status for user: ${pitch.userId}`);
        const response = await fetch(`/api/users/${pitch.userId}/follow`);
        console.log('Follow status response:', response.status);

        if (!response.ok) {
          console.error('Failed to fetch follow status:', response.status);
          return;
        }

        const data = await response.json();
        console.log('Follow status data:', data);
        setIsFollowing(data.isFollowing);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    if (!isGuest) {
      fetchFollowStatus();
    }
  }, [pitch.userId, isGuest]);

  const handleFollowClick = async () => {
    if (isGuest && onSignInClick) {
      onSignInClick();
      return;
    }

    setIsLoadingFollow(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/users/${pitch.userId}/follow`, {
        method,
      });

      console.log(`Follow ${method} response status:`, response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error(`Failed to ${method} follow. Status:`, response.status, 'Error:', error);
        setIsLoadingFollow(false);
        return;
      }

      const data = await response.json();
      console.log(`Follow ${method} success response:`, data);
      setIsFollowing(data.isFollowing);
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleRoastClick = () => {
    if (isGuest) {
      onRoast();
      return;
    }

    setJustRoasted(true);
    onRoast();
    setTimeout(() => setJustRoasted(false), 1000);
  };

  const handleRoastLongPress = () => {
    onOpenFeedback('roast');
  };

  const handleToastClick = () => {
    if (isGuest) {
      onToast();
      return;
    }

    setJustToasted(true);
    onToast();
    setTimeout(() => setJustToasted(false), 1000);
  };

  const handleToastLongPress = () => {
    onOpenFeedback('toast');
  };

  const handleDetailedFeedbackClick = () => {
    if (isGuest && onSignInClick) {
      onSignInClick();
      return;
    }

    if (onOpenFeedbackList) {
      onOpenFeedbackList();
      return;
    }

    onOpenFeedback(userReaction || 'toast');
  };

  const handleBookmarkClick = async () => {
    if (isGuest && onSignInClick) {
      onSignInClick();
      return;
    }

    const newBookmarkState = !bookmarkState;
    setBookmarkState(newBookmarkState);
    const result = await onBookmark?.(newBookmarkState);
    if (result === false) {
      setBookmarkState(!newBookmarkState);
    }
  };

  const handleAvatarClick = () => {
    router.push(`/profile/${pitch.userId}`);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Founder Avatar - Like TikTok profile */}
      <div className="relative mb-2">
        <motion.img
          whileTap={{ scale: 0.95 }}
          onClick={handleAvatarClick}
          src={pitch.founderAvatar}
          alt={pitch.founderName}
          className="w-12 h-12 rounded-full border-2 border-white cursor-pointer shadow-lg hover:border-neon-cyan transition-colors"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
        />
        {/* Follow Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleFollowClick}
          disabled={isLoadingFollow}
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer shadow-lg border transition-all ${
            isFollowing
              ? 'bg-neon-lime border-neon-lime'
              : 'bg-neon-cyan border-white hover:bg-neon-cyan/90'
          } ${isLoadingFollow ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Plus className={`w-3 h-3 ${isFollowing ? 'text-slate-900' : 'text-slate-900'}`} strokeWidth={3} />
        </motion.button>
      </div>

      {/* Roast Button - Tap for quick roast, hold for detailed feedback */}
      <motion.button
        onClick={handleRoastClick}
        onDoubleClick={handleRoastLongPress}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <motion.div
          animate={justRoasted ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 h-12 w-12 rounded-full bg-roast/10 blur-md"
            animate={justRoasted ? { scale: [1, 1.22, 1], opacity: [0.35, 0.65, 0.25] } : {}}
          />

          {/* Main circular button background */}
          <div className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border backdrop-blur-xl transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.28)] before:absolute before:inset-x-2 before:top-1 before:h-3 before:rounded-full before:bg-white/[0.18] before:blur-sm ${
            userReaction === 'roast'
              ? 'bg-white/[0.18] border-roast/[0.45] ring-1 ring-roast/[0.25]'
              : 'bg-white/[0.12] border-white/20 hover:border-roast/[0.35] hover:bg-white/[0.18]'
          }`}>
            {/* Icon container - both icons always in DOM for stable click handling */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Emoji - shows when roastCount > 0 */}
              <RoastEmoji
                className={`text-2xl transition-all duration-300 absolute ${
                  pitch.roastCount > 0 ? 'opacity-90' : 'opacity-0 pointer-events-none'
                } ${
                  userReaction === 'roast'
                    ? 'drop-shadow-[0_0_8px_rgba(255,59,48,0.55)]'
                    : justRoasted ? 'drop-shadow-[0_0_8px_rgba(255,59,48,0.5)]' : ''
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              />
              {/* Icon - shows when roastCount = 0 */}
              <Flame
                className={`h-6 w-6 transition-all duration-300 absolute ${
                  pitch.roastCount > 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                } ${
                  userReaction === 'roast'
                    ? 'text-roast drop-shadow-[0_0_8px_rgba(255,59,48,0.55)]'
                    : justRoasted ? 'text-roast drop-shadow-[0_0_8px_rgba(255,59,48,0.5)]' : 'text-white/90 group-hover:text-roast'
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                strokeWidth={1.5}
              />
            </div>

            {/* Comment count badge */}
            {pitch.feedback && pitch.feedback.filter(f => f.type === 'roast').length > 0 && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-black/55 shadow-lg backdrop-blur-md">
                <span className="text-[10px] font-bold text-roast">
                  {pitch.feedback.filter(f => f.type === 'roast').length}
                </span>
              </div>
            )}
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {formatNumber(pitch.roastCount)}
          </span>
        </div>

      </motion.button>

      {/* Toast Button - Tap for quick toast, hold for detailed feedback */}
      <motion.button
        onClick={handleToastClick}
        onDoubleClick={handleToastLongPress}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <motion.div
          animate={justToasted ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 h-12 w-12 rounded-full bg-toast/10 blur-md"
            animate={justToasted ? { scale: [1, 1.22, 1], opacity: [0.35, 0.65, 0.25] } : {}}
          />

          {/* Main circular button background */}
          <div className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border backdrop-blur-xl transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.28)] before:absolute before:inset-x-2 before:top-1 before:h-3 before:rounded-full before:bg-white/[0.18] before:blur-sm ${
            userReaction === 'toast'
              ? 'bg-white/[0.18] border-toast/[0.45] ring-1 ring-toast/[0.25]'
              : 'bg-white/[0.12] border-white/20 hover:border-toast/[0.35] hover:bg-white/[0.18]'
          }`}>
            {/* Icon container - both icons always in DOM for stable click handling */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Emoji - shows when toastCount > 0 */}
              <ToastEmoji
                className={`text-2xl transition-all duration-300 absolute ${
                  pitch.toastCount > 0 ? 'opacity-90' : 'opacity-0 pointer-events-none'
                } ${
                  userReaction === 'toast'
                    ? 'drop-shadow-[0_0_8px_rgba(52,199,89,0.55)]'
                    : justToasted ? 'drop-shadow-[0_0_8px_rgba(52,199,89,0.5)]' : ''
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              />
              {/* Icon - shows when toastCount = 0 */}
              <Wine
                className={`h-6 w-6 transition-all duration-300 absolute ${
                  pitch.toastCount > 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                } ${
                  userReaction === 'toast'
                    ? 'text-toast drop-shadow-[0_0_8px_rgba(52,199,89,0.55)]'
                    : justToasted ? 'text-toast drop-shadow-[0_0_8px_rgba(52,199,89,0.5)]' : 'text-white/90 group-hover:text-toast'
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                strokeWidth={1.5}
              />
            </div>

            {/* Comment count badge */}
            {pitch.feedback && pitch.feedback.filter(f => f.type === 'toast').length > 0 && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-black/55 shadow-lg backdrop-blur-md">
                <span className="text-[10px] font-bold text-toast">
                  {pitch.feedback.filter(f => f.type === 'toast').length}
                </span>
              </div>
            )}
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {formatNumber(pitch.toastCount)}
          </span>
        </div>

      </motion.button>

      {/* Detailed Feedback - visible entry point for written/scored comments */}
      <motion.button
        onClick={handleDetailedFeedbackClick}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
        aria-label="Leave detailed feedback"
      >
        <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 before:absolute before:inset-x-2 before:top-1 before:h-3 before:rounded-full before:bg-white/[0.18] before:blur-sm hover:border-neon-cyan/[0.45] hover:bg-white/[0.18]">
          <MessageSquareText
            className="relative z-10 h-6 w-6 text-white/90 transition-colors group-hover:text-neon-cyan"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            strokeWidth={1.7}
          />
        </div>
        <span className="text-xs font-bold text-white drop-shadow-md">
          {formatNumber(pitch.feedback?.length || 0)}
        </span>
      </motion.button>

      {/* Bookmark Button - Save pitch for later */}
      <motion.button
        onClick={handleBookmarkClick}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <motion.div
          animate={bookmarkState ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 h-12 w-12 bg-neon-cyan/10 rounded-full blur-sm"
            animate={bookmarkState ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : {}}
          />

          {/* Main circular button background */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:border-neon-cyan/[0.45] hover:bg-white/[0.18]">
            <Bookmark
              className={`h-6 w-6 transition-all duration-300 ${
                bookmarkState
                  ? 'text-neon-cyan fill-neon-cyan drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]'
                  : 'text-white group-hover:text-neon-cyan'
              }`}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              strokeWidth={1.5}
            />
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {formatNumber(bookmarkCount)}
          </span>
        </div>
      </motion.button>

      {/* Share Button */}
      <motion.button
        onClick={onShare}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className="relative flex flex-col items-center gap-2 group"
      >
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:border-white/[0.35] hover:bg-white/[0.18]">
          <Share2
            className="h-6 w-6 text-white/90 transition-all duration-300 group-hover:text-slate-200"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            strokeWidth={1.5}
          />
        </div>
      </motion.button>

    </div>
  );
}
