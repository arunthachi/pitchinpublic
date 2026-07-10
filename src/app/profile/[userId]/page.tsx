'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ExternalLink,
  Flame,
  Globe,
  Grid3X3,
  Linkedin,
  LogOut,
  MessageSquareText,
  Play,
  Sparkles,
  Target,
  Trophy,
  Video,
  Wine,
} from 'lucide-react';
import { LegacyPitch, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPitchFeedbackAskFromFields,
  getPitchStartupNameFromFields,
  getTakeLabel,
} from '@/lib/pitch-copy';

type ProfileTab = 'pitches' | 'best' | 'feedback' | 'goals';

interface FinalTake {
  id: string;
  event_id: string;
  pitch_id: string;
  status: string;
}

interface PitchMomentumDay {
  date: Date;
  key: string;
  level: number;
  pitchCount: number;
  feedbackCount: number;
  finalCount: number;
}

function parseFeedback(rawFeedback: any[] | undefined) {
  return (rawFeedback || []).map((item) => {
    let parsedContent: any = {};
    try {
      parsedContent = item.content ? JSON.parse(item.content) : {};
    } catch {
      parsedContent = { notes: item.content || '' };
    }

    return {
      id: item.id,
      authorName: 'Builder',
      authorRole: 'Founder',
      type: item.type,
      signal: parsedContent.signal,
      signals: parsedContent.signals || (parsedContent.signal ? [parsedContent.signal] : undefined),
      readiness: parsedContent.readiness,
      scores: parsedContent.scores || {
        clarity: 5,
        solution: 5,
        market: 5,
        presentation: 5,
      },
      notes: parsedContent.notes || '',
      createdAt: item.created_at,
    };
  });
}

function convertApiPitchToLegacy(pitch: any): LegacyPitch {
  const profile = pitch.profiles || {};
  return {
    id: pitch.id,
    userId: pitch.user_id,
    founderName: profile.full_name || 'Founder',
    founderAvatar: profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP',
    companyName: getPitchStartupNameFromFields(pitch, 'Practice pitch'),
    hook: pitch.hook,
    description: pitch.description || '',
    feedbackAsk: getPitchFeedbackAskFromFields(pitch),
    videoUrl: pitch.video_url,
    thumbnailUrl: pitch.thumbnail_url || '',
    industry: 'SaaS',
    stage: 'Pre-Seed',
    views: pitch.views_count || 0,
    interestScore: pitch.interest_score || 0,
    roastCount: pitch.roast_count || 0,
    toastCount: pitch.toast_count || 0,
    createdAt: pitch.created_at,
    duration: pitch.duration || undefined,
    versionNumber: pitch.take_version || pitch.version_number,
    practiceGoalId: pitch.practice_goal_id || null,
    promptKey: pitch.prompt_key || null,
    promptText: pitch.prompt_text || null,
    isBestTake: Boolean(pitch.is_best_take),
    feedback: parseFeedback(pitch.feedback),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function toDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function buildPitchMomentumDays(pitches: LegacyPitch[], finalPitchIds: Set<string>) {
  const today = startOfDay(new Date());
  const start = addDays(today, -111);
  const activityByDate = new Map<string, { pitchCount: number; feedbackCount: number; finalCount: number }>();

  pitches.forEach((pitch) => {
    const pitchKey = toDateKey(pitch.createdAt);
    const current = activityByDate.get(pitchKey) || { pitchCount: 0, feedbackCount: 0, finalCount: 0 };
    current.pitchCount += 1;
    if (finalPitchIds.has(pitch.id)) current.finalCount += 1;
    activityByDate.set(pitchKey, current);

    (pitch.feedback || []).forEach((feedback) => {
      if (!feedback.createdAt) return;
      const feedbackKey = toDateKey(feedback.createdAt);
      const feedbackDay = activityByDate.get(feedbackKey) || { pitchCount: 0, feedbackCount: 0, finalCount: 0 };
      feedbackDay.feedbackCount += 1;
      activityByDate.set(feedbackKey, feedbackDay);
    });
  });

  return Array.from({ length: 112 }, (_, index) => {
    const date = addDays(start, index);
    const key = toDateKey(date);
    const activity = activityByDate.get(key) || { pitchCount: 0, feedbackCount: 0, finalCount: 0 };
    const score = activity.pitchCount * 2 + activity.feedbackCount + activity.finalCount * 2;

    return {
      date,
      key,
      level: Math.min(4, score),
      ...activity,
    };
  });
}

function getStreakStats(days: PitchMomentumDay[]) {
  const activeKeys = new Set(days.filter((day) => day.level > 0).map((day) => day.key));
  const today = startOfDay(new Date());
  let current = 0;
  let cursor = today;

  while (activeKeys.has(toDateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  days.forEach((day) => {
    if (day.level > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  });

  return {
    activeDays: activeKeys.size,
    current,
    longest,
  };
}

function readinessLabel(value: number) {
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { user: currentUser, signOut } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [pitches, setPitches] = useState<LegacyPitch[]>([]);
  const [finalTakes, setFinalTakes] = useState<FinalTake[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('pitches');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const [profileRes, pitchesRes, finalTakesRes] = await Promise.all([
          fetch(`/api/users/${userId}/profile`),
          fetch(`/api/pitches?userId=${userId}&limit=100`),
          fetch(`/api/users/${userId}/submissions`),
        ]);

        if (!profileRes.ok) throw new Error('Could not load profile.');
        const profileData = await profileRes.json();
        setProfile(profileData.user);

        if (pitchesRes.ok) {
          const pitchData = await pitchesRes.json();
          setPitches((pitchData.pitches || []).map(convertApiPitchToLegacy));
        }

        if (finalTakesRes.ok) {
          const finalTakeData = await finalTakesRes.json();
          setFinalTakes(finalTakeData.submissions || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load profile.');
      } finally {
        setLoading(false);
      }
    };

    if (userId) loadProfile();
  }, [userId]);

  const finalPitchIds = useMemo(() => new Set(finalTakes.map((take) => take.pitch_id)), [finalTakes]);
  const allFeedback = pitches.flatMap((pitch) => pitch.feedback || []);
  const momentumDays = useMemo(() => buildPitchMomentumDays(pitches, finalPitchIds), [pitches, finalPitchIds]);
  const momentumStats = useMemo(() => getStreakStats(momentumDays), [momentumDays]);
  const avgReadiness = allFeedback.length
    ? Math.round((allFeedback.reduce((sum, item) => sum + (item.readiness || 2), 0) / allFeedback.length) * 10) / 10
    : 0;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleMarkBestTake = async (pitchId: string) => {
    try {
      const response = await fetch(`/api/pitches/${pitchId}/best-take`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Could not mark best take.');

      setPitches((current) =>
        current.map((pitch) => ({
          ...pitch,
          isBestTake: pitch.id === pitchId,
        }))
      );
      setActiveTab('best');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not mark best take.');
    }
  };

  const visiblePitches = activeTab === 'best'
    ? pitches.filter((pitch) => finalPitchIds.has(pitch.id) || pitch.isBestTake)
    : pitches;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center">
        <p className="text-slate-300">{error || 'User not found'}</p>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-neon-cyan px-4 py-2 font-semibold text-slate-950"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Founder portfolio
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/?alpha=1&preview=1"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              Practice
            </Link>
            {isOwnProfile && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-full border border-roast/30 bg-roast/10 px-3 py-2 text-sm font-semibold text-roast transition hover:border-roast/60 hover:bg-roast/15 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="glass-panel overflow-hidden rounded-[2rem]">
          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="flex flex-col gap-5 sm:flex-row">
              <img
                src={profile.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
                alt={profile.name}
                className="h-24 w-24 rounded-3xl border border-white/15 object-cover shadow-2xl shadow-neon-cyan/10"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">
                  <Sparkles className="h-3.5 w-3.5" />
                  {isOwnProfile ? 'Your profile' : 'Founder'}
                </div>
                <h1 className="font-heading text-4xl font-black leading-tight text-white sm:text-5xl">
                  {profile.name}
                </h1>
                {profile.bio && (
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{profile.bio}</p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200">
                      <Globe className="h-4 w-4" />
                      Website
                    </a>
                  )}
                  {profile.linkedin && (
                    <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {[
                { label: 'Pitches', value: pitches.length, icon: Video },
                { label: 'Final takes', value: finalTakes.length, icon: Trophy },
                { label: 'Coach notes', value: allFeedback.length, icon: MessageSquareText },
                { label: 'Readiness', value: avgReadiness ? readinessLabel(avgReadiness) : 'New', icon: Target },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <Icon className="mb-3 h-5 w-5 text-neon-lime" />
                    <p className="font-heading text-2xl font-black text-white">{stat.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <PitchMomentumHeatmap
          days={momentumDays}
          totalPitches={pitches.length}
          totalFeedback={allFeedback.length}
          activeDays={momentumStats.activeDays}
          currentStreak={momentumStats.current}
          longestStreak={momentumStats.longest}
        />

        <nav className="mt-8 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-1 backdrop-blur-xl">
          {[
            { id: 'pitches' as const, label: 'Pitches', icon: Grid3X3 },
            { id: 'best' as const, label: 'Final Takes', icon: Trophy },
            { id: 'feedback' as const, label: 'Feedback', icon: MessageSquareText },
            { id: 'goals' as const, label: 'Goals', icon: Target },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                  active ? 'bg-neon-cyan text-slate-950' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === 'feedback' ? (
          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {allFeedback.length ? allFeedback.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase ${item.type === 'roast' ? 'bg-roast/15 text-roast' : 'bg-toast/15 text-toast'}`}>
                    {item.type === 'roast' ? <Flame className="h-3.5 w-3.5" /> : <Wine className="h-3.5 w-3.5" />}
                    {(item.signals?.length ? item.signals.join(' + ') : item.signal) || item.type}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{readinessLabel(item.readiness || 2)}</span>
                </div>
                <p className="text-sm leading-6 text-slate-200">{item.notes || 'Signal-only coach note.'}</p>
              </article>
            )) : (
              <EmptyState title="No feedback yet" body="Coach notes will appear here after builders respond to pitches." />
            )}
          </section>
        ) : activeTab === 'goals' ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">Pitch goals</p>
            <h2 className="mt-3 font-heading text-3xl font-bold">Event and personal goals are tracked from pitch practice.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-400">
              Record practice reps, collect feedback, and mark one Best Take. If an organizer invites you to an event, your submitted take will show here.
            </p>
            <Link href="/?alpha=1&preview=1" className="mt-5 inline-flex rounded-xl bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
              Back to practice
            </Link>
          </section>
        ) : visiblePitches.length ? (
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visiblePitches.map((pitch, index) => (
              <motion.div
                key={pitch.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <article className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-lg shadow-black/25 transition hover:-translate-y-1 hover:border-neon-cyan/60">
                  <Link href={`/pitch/${pitch.id}`} className="absolute inset-0">
                    <span className="sr-only">Open pitch</span>
                  </Link>
                  {pitch.thumbnailUrl ? (
                    <img src={pitch.thumbnailUrl} alt={pitch.hook} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,rgba(0,230,246,0.18),rgba(183,255,42,0.16)),#05070a]">
                      <Video className="h-10 w-10 text-white/60" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
                    {(finalPitchIds.has(pitch.id) || pitch.isBestTake) && (
                      <span className="rounded-full bg-neon-lime px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950">
                        Best
                      </span>
                    )}
                    <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur">
                      {getTakeLabel(pitch.versionNumber, pitch.isBestTake)}
                    </span>
                    <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                      {pitch.duration || 60}s
                    </span>
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="line-clamp-2 text-sm font-bold leading-5 text-white">{pitch.hook}</p>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-300">
                      Ask: {pitch.feedbackAsk || getPitchFeedbackAskFromFields({ description: pitch.description })}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-300">
                      <span className="inline-flex items-center gap-1"><Wine className="h-3 w-3 text-toast" />{pitch.toastCount}</span>
                      <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-roast" />{pitch.roastCount}</span>
                      <span>{formatDate(pitch.createdAt)}</span>
                    </div>
                    {isOwnProfile && !pitch.isBestTake && (
                      <button
                        type="button"
                        onClick={() => handleMarkBestTake(pitch.id)}
                        className="relative z-10 mt-3 inline-flex w-full items-center justify-center rounded-full border border-neon-lime/40 bg-neon-lime/15 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-neon-lime opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                      >
                        Mark Best Take
                      </button>
                    )}
                  </div>
                </article>
              </motion.div>
            ))}
          </section>
        ) : (
          <EmptyState
            title={activeTab === 'best' ? 'No final take selected yet' : 'No pitches yet'}
            body={activeTab === 'best' ? 'Join a pitch event and submit your strongest take.' : 'Record your first pitch to start building your portfolio.'}
          />
        )}
      </main>
    </div>
  );
}

function PitchMomentumHeatmap({
  days,
  totalPitches,
  totalFeedback,
  activeDays,
  currentStreak,
  longestStreak,
}: {
  days: PitchMomentumDay[];
  totalPitches: number;
  totalFeedback: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}) {
  const monthMarkers = days.reduce<Array<{ label: string; index: number }>>((markers, day, index) => {
    if (day.date.getDate() <= 7) {
      const label = new Intl.DateTimeFormat('en', { month: 'short' }).format(day.date);
      if (markers[markers.length - 1]?.label !== label) markers.push({ label, index });
    }
    return markers;
  }, []);

  const levelClass = [
    'bg-white/[0.055] border-white/[0.04]',
    'bg-neon-cyan/18 border-neon-cyan/10',
    'bg-neon-cyan/34 border-neon-cyan/20',
    'bg-toast/48 border-toast/25',
    'bg-neon-lime/85 border-neon-lime/35 shadow-[0_0_18px_rgba(183,255,42,0.22)]',
  ];

  return (
    <section className="glass-card mt-6 rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">Pitch Momentum</p>
          <h2 className="mt-2 font-heading text-2xl font-black text-white">Practice reps over the last 16 weeks</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Brighter days mean more pitch reps, received feedback, or a final take submitted.
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/10 bg-black/20 text-center sm:min-w-[420px]">
          {[
            { label: 'Active days', value: activeDays },
            { label: 'Current run', value: `${currentStreak}d` },
            { label: 'Best run', value: `${longestStreak}d` },
          ].map((stat) => (
            <div key={stat.label} className="border-r border-white/10 px-4 py-3 last:border-r-0">
              <p className="font-heading text-xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="min-w-[780px]">
          <div className="relative mb-3 h-5">
            {monthMarkers.map((marker) => (
              <span
                key={`${marker.label}-${marker.index}`}
                className="absolute text-xs font-semibold text-slate-500"
                style={{ left: `${(marker.index / Math.max(1, days.length - 1)) * 100}%` }}
              >
                {marker.label}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-1.5"
            style={{ gridTemplateColumns: `repeat(${Math.ceil(days.length / 7)}, minmax(0, 1fr))` }}
          >
            {days.map((day) => (
              <div
                key={day.key}
                title={`${formatDate(day.key)}: ${day.pitchCount} pitch reps, ${day.feedbackCount} feedback notes, ${day.finalCount} final takes`}
                className={`h-4 w-4 rounded-[5px] border transition hover:scale-125 ${levelClass[day.level]}`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-3">
              <span>{totalPitches} pitch reps</span>
              <span>{totalFeedback} feedback notes</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} className={`h-3 w-3 rounded-[4px] border ${levelClass[level]}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
        <Video className="h-7 w-7" />
      </div>
      <h3 className="font-heading text-2xl font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md leading-7 text-slate-400">{body}</p>
    </div>
  );
}
