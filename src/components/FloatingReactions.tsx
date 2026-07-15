'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Flame, Wine, Share2, Plus, Bookmark, MessageSquareText } from 'lucide-react';
import { LegacyPitch } from '@/types';
import { formatNumber } from '@/lib/utils';
import { profilePath } from '@/lib/public-routes';

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
  reactionPending?: boolean;
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
  reactionPending = false,
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
        const response = await fetch(`/api/users/${pitch.userId}/follow`);

        if (!response.ok) {
          console.error('Failed to fetch follow status:', response.status);
          return;
        }

        const data = await response.json();
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

      if (!response.ok) {
        const error = await response.json();
        console.error(`Failed to ${method} follow. Status:`, response.status, 'Error:', error);
        setIsLoadingFollow(false);
        return;
      }

      const data = await response.json();
      setIsFollowing(data.isFollowing);
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleRoastClick = () => {
    if (reactionPending) return;

    if (isGuest) {
      onRoast();
      return;
    }

    setJustRoasted(true);
    onRoast();
    setTimeout(() => setJustRoasted(false), 1000);
  };

  const handleToastClick = () => {
    if (reactionPending) return;

    if (isGuest) {
      onToast();
      return;
    }

    setJustToasted(true);
    onToast();
    setTimeout(() => setJustToasted(false), 1000);
  };

  const handleDetailedFeedbackClick = () => {
    if (onOpenFeedbackList) {
      onOpenFeedbackList();
      return;
    }

    if (isGuest && onSignInClick) {
      onSignInClick();
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
    const href = profilePath(pitch.founderHandle);
    if (href) router.push(href);
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
          className="h-11 w-11 cursor-pointer rounded-full border border-white/65 shadow-lg transition-colors hover:border-neon-cyan"
          style={{ filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.45))' }}
        />
        {/* Follow Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleFollowClick}
          disabled={isLoadingFollow}
          className={`absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border shadow-lg transition-all ${
            isFollowing
              ? 'bg-neon-lime border-neon-lime'
              : 'bg-neon-cyan border-white hover:bg-neon-cyan/90'
          } ${isLoadingFollow ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Plus className="h-3 w-3 text-slate-900" strokeWidth={3} />
        </motion.button>
      </div>

      {/* Roast Button - quick reaction */}
      <motion.button
        type="button"
        onClick={handleRoastClick}
        disabled={reactionPending}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className={`relative flex touch-manipulation flex-col items-center gap-2 group ${
          reactionPending ? 'cursor-wait opacity-75' : ''
        }`}
        aria-label="Roast this pitch"
        aria-pressed={userReaction === 'roast'}
      >
        <motion.div
          animate={justRoasted ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 h-11 w-11 rounded-full bg-roast/5 blur-sm"
            animate={justRoasted ? { scale: [1, 1.22, 1], opacity: [0.35, 0.65, 0.25] } : {}}
          />

          {/* Main circular button background */}
          <div className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border backdrop-blur-xl transition-all duration-200 ${
            userReaction === 'roast'
              ? 'border-roast/[0.45] bg-roast/[0.14]'
              : 'border-white/15 bg-black/[0.24] hover:border-roast/[0.35] hover:bg-white/[0.12]'
          }`}>
            {/* Icon container - both icons always in DOM for stable click handling */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Emoji - shows when roastCount > 0 */}
              <RoastEmoji
                className={`absolute text-xl transition-all duration-300 ${
                  pitch.roastCount > 0 ? 'opacity-90' : 'opacity-0 pointer-events-none'
                } ${
                  userReaction === 'roast'
                    ? 'drop-shadow-[0_0_8px_rgba(255,90,77,0.55)]'
                    : justRoasted ? 'drop-shadow-[0_0_8px_rgba(255,90,77,0.5)]' : ''
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              />
              {/* Icon - shows when roastCount = 0 */}
              <Flame
                className={`absolute h-5 w-5 transition-all duration-300 ${
                  pitch.roastCount > 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                } ${
                  userReaction === 'roast'
                    ? 'text-roast drop-shadow-[0_0_8px_rgba(255,90,77,0.55)]'
                    : justRoasted ? 'text-roast drop-shadow-[0_0_8px_rgba(255,90,77,0.5)]' : 'text-white/90 group-hover:text-roast'
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                strokeWidth={1.5}
              />
            </div>

            {/* Comment count badge */}
            {pitch.feedback && pitch.feedback.filter(f => f.type === 'roast').length > 0 && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-black/[0.55] shadow-lg backdrop-blur-md">
                <span className="text-[10px] font-bold text-roast">
                  {pitch.feedback.filter(f => f.type === 'roast').length}
                </span>
              </div>
            )}
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-[11px] font-bold text-white/[0.92] drop-shadow-md">
            {formatNumber(pitch.roastCount)}
          </span>
        </div>

      </motion.button>

      {/* Toast Button - quick reaction */}
      <motion.button
        type="button"
        onClick={handleToastClick}
        disabled={reactionPending}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        className={`relative flex touch-manipulation flex-col items-center gap-2 group ${
          reactionPending ? 'cursor-wait opacity-75' : ''
        }`}
        aria-label="Toast this pitch"
        aria-pressed={userReaction === 'toast'}
      >
        <motion.div
          animate={justToasted ? { scale: [1, 1.2, 1] } : {}}
          className="relative"
        >
          {/* Circular background */}
          <motion.div
            className="absolute inset-0 h-11 w-11 rounded-full bg-toast/5 blur-sm"
            animate={justToasted ? { scale: [1, 1.22, 1], opacity: [0.35, 0.65, 0.25] } : {}}
          />

          {/* Main circular button background */}
          <div className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border backdrop-blur-xl transition-all duration-200 ${
            userReaction === 'toast'
              ? 'border-toast/[0.45] bg-toast/[0.14]'
              : 'border-white/15 bg-black/[0.24] hover:border-toast/[0.35] hover:bg-white/[0.12]'
          }`}>
            {/* Icon container - both icons always in DOM for stable click handling */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Emoji - shows when toastCount > 0 */}
              <ToastEmoji
                className={`absolute text-xl transition-all duration-300 ${
                  pitch.toastCount > 0 ? 'opacity-90' : 'opacity-0 pointer-events-none'
                } ${
                  userReaction === 'toast'
                    ? 'drop-shadow-[0_0_8px_rgba(53,201,111,0.55)]'
                    : justToasted ? 'drop-shadow-[0_0_8px_rgba(53,201,111,0.5)]' : ''
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              />
              {/* Icon - shows when toastCount = 0 */}
              <Wine
                className={`absolute h-5 w-5 transition-all duration-300 ${
                  pitch.toastCount > 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                } ${
                  userReaction === 'toast'
                    ? 'text-toast drop-shadow-[0_0_8px_rgba(53,201,111,0.55)]'
                    : justToasted ? 'text-toast drop-shadow-[0_0_8px_rgba(53,201,111,0.5)]' : 'text-white/90 group-hover:text-toast'
                }`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                strokeWidth={1.5}
              />
            </div>

            {/* Comment count badge */}
            {pitch.feedback && pitch.feedback.filter(f => f.type === 'toast').length > 0 && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-black/[0.55] shadow-lg backdrop-blur-md">
                <span className="text-[10px] font-bold text-toast">
                  {pitch.feedback.filter(f => f.type === 'toast').length}
                </span>
              </div>
            )}
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-[11px] font-bold text-white/[0.92] drop-shadow-md">
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
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/[0.24] backdrop-blur-xl transition-all duration-200 hover:border-neon-cyan/40 hover:bg-white/[0.12]">
          <MessageSquareText
            className="relative z-10 h-5 w-5 text-white/88 transition-colors group-hover:text-neon-cyan"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            strokeWidth={1.7}
          />
        </div>
        <span className="text-[11px] font-bold text-white/[0.92] drop-shadow-md">
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
            className="absolute inset-0 h-10 w-10 rounded-full bg-neon-cyan/5 blur-sm"
            animate={bookmarkState ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : {}}
          />

          {/* Main circular button background */}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/[0.24] backdrop-blur-xl transition-all duration-200 hover:border-neon-cyan/40 hover:bg-white/[0.12]">
            <Bookmark
              className={`h-5 w-5 transition-all duration-300 ${
                bookmarkState
                  ? 'text-neon-cyan fill-neon-cyan drop-shadow-[0_0_12px_rgba(0,230,246,0.72)]'
                  : 'text-white group-hover:text-neon-cyan'
              }`}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              strokeWidth={1.5}
            />
          </div>
        </motion.div>
        <div className="text-center">
          <span className="text-[11px] font-bold text-white/[0.92] drop-shadow-md">
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
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/[0.24] backdrop-blur-xl transition-all duration-200 hover:border-white/30 hover:bg-white/[0.12]">
          <Share2
            className="h-5 w-5 text-white/88 transition-all duration-300 group-hover:text-slate-200"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            strokeWidth={1.5}
          />
        </div>
      </motion.button>

    </div>
  );
}
