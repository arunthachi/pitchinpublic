'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Mail, Globe, Twitter, Linkedin } from 'lucide-react';
import { User, LegacyPitch } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { PitchCard } from '@/components/PitchCard';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [pitches, setPitches] = useState<LegacyPitch[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPitches, setIsLoadingPitches] = useState(true);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true);
        const response = await fetch(`/api/users/${userId}/profile`);
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfile(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  // Fetch user's pitches
  useEffect(() => {
    const fetchPitches = async () => {
      try {
        setIsLoadingPitches(true);
        const response = await fetch(`/api/pitches?userId=${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch pitches');
        }
        const data = await response.json();
        setPitches(data.pitches || []);
      } catch (err) {
        console.error('Failed to fetch pitches:', err);
        setPitches([]);
      } finally {
        setIsLoadingPitches(false);
      }
    };

    if (userId) {
      fetchPitches();
    }
  }, [userId]);

  // Check follow status
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!currentUser) {
        setIsFollowing(false);
        return;
      }

      try {
        const response = await fetch(`/api/users/${userId}/follow`);
        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.isFollowing);
        }
      } catch (err) {
        console.error('Failed to check follow status:', err);
      }
    };

    if (userId && currentUser) {
      checkFollowStatus();
    }
  }, [userId, currentUser]);

  const handleFollowClick = async () => {
    if (!currentUser) {
      router.push('/');
      return;
    }

    setIsLoadingFollow(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/users/${userId}/follow`, {
        method,
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status');
      }

      const data = await response.json();
      setIsFollowing(data.isFollowing);

      // Update follower count optimistically
      if (profile) {
        setProfile({
          ...profile,
          followersCount: isFollowing
            ? profile.followersCount - 1
            : profile.followersCount + 1,
        });
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
    } finally {
      setIsLoadingFollow(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-300">{error || 'User not found'}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-neon-cyan text-slate-900 rounded-lg font-semibold hover:bg-neon-lime transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-300 hover:text-neon-cyan transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="font-heading font-bold text-white">{profile.name}</h1>
          <div className="w-12" />
        </div>
      </div>

      {/* Profile Section */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8"
        >
          {/* Avatar and Basic Info */}
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Avatar */}
            <div className="relative">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-24 h-24 rounded-full border-4 border-neon-cyan object-cover shadow-lg shadow-neon-cyan/25"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <h2 className="font-heading font-bold text-3xl text-white mb-1">
                {profile.name}
              </h2>
              <p className="text-slate-400 text-sm mb-4">{profile.email}</p>

              {profile.bio && (
                <p className="text-slate-300 mb-4 leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>
              )}

              {/* Social Links */}
              <div className="flex flex-wrap gap-3 mb-6">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-neon-cyan transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm">Website</span>
                  </a>
                )}
                {profile.twitter && (
                  <a
                    href={`https://twitter.com/${profile.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-neon-cyan transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                    <span className="text-sm">Twitter</span>
                  </a>
                )}
                {profile.linkedin && (
                  <a
                    href={`https://linkedin.com/in/${profile.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-neon-cyan transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span className="text-sm">LinkedIn</span>
                  </a>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-6 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-neon-cyan">
                    {profile.pitchesCount}
                  </p>
                  <p className="text-sm text-slate-400">Pitches</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-neon-cyan">
                    {profile.followersCount}
                  </p>
                  <p className="text-sm text-slate-400">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-neon-cyan">
                    {profile.followingCount}
                  </p>
                  <p className="text-sm text-slate-400">Following</p>
                </div>
              </div>

              {/* Follow Button */}
              {!isOwnProfile && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFollowClick}
                  disabled={isLoadingFollow}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    isFollowing
                      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      : 'bg-neon-cyan text-slate-900 hover:bg-neon-lime'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoadingFollow ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Pitches Section */}
        <div className="mt-12">
          <h3 className="font-heading font-bold text-2xl text-white mb-6">
            {isOwnProfile ? 'Your' : `${profile.name}'s`} Pitches
          </h3>

          {isLoadingPitches ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pitches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pitches.map((pitch, index) => (
                <PitchCard
                  key={pitch.id}
                  pitch={pitch}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-12">
              No pitches yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
