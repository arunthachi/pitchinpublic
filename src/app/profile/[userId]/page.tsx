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

type ProfileTab = 'pitches' | 'best' | 'feedback' | 'goals';

interface FinalTake {
  id: string;
  event_id: string;
  pitch_id: string;
  status: string;
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
    companyName: pitch.description || 'Practice pitch',
    hook: pitch.hook,
    description: pitch.description || '',
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
    feedback: parseFeedback(pitch.feedback),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
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
  const { user: currentUser } = useAuth();

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
  const avgReadiness = allFeedback.length
    ? Math.round((allFeedback.reduce((sum, item) => sum + (item.readiness || 2), 0) / allFeedback.length) * 10) / 10
    : 0;

  const visiblePitches = activeTab === 'best'
    ? pitches.filter((pitch) => finalPitchIds.has(pitch.id))
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
          <Link
            href="/?alpha=1&preview=1"
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            Practice
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(0,240,255,0.10),rgba(163,255,18,0.08)),rgba(255,255,255,0.035)] shadow-2xl shadow-black/30 backdrop-blur-2xl">
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
                    {item.signal || item.type}
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
            <h2 className="mt-3 font-heading text-3xl font-bold">Event and personal goals are tracked from pitch sprints.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-400">
              Join a pitch sprint, record reps, and mark one final take. Your sprint status and submitted takes will show here.
            </p>
            <Link href="/events/new" className="mt-5 inline-flex rounded-xl bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
              Create pitch sprint
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
                <Link
                  href={`/pitch/${pitch.id}`}
                  className="group relative block aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-lg shadow-black/25 transition hover:-translate-y-1 hover:border-neon-cyan/60"
                >
                  {pitch.thumbnailUrl ? (
                    <img src={pitch.thumbnailUrl} alt={pitch.hook} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,rgba(0,240,255,0.18),rgba(163,255,18,0.16)),#020617]">
                      <Video className="h-10 w-10 text-white/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute left-3 top-3 flex gap-2">
                    {finalPitchIds.has(pitch.id) && (
                      <span className="rounded-full bg-neon-lime px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950">
                        Final
                      </span>
                    )}
                    <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                      {pitch.duration || 60}s
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="line-clamp-2 text-sm font-bold leading-5 text-white">{pitch.hook}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-300">
                      <span className="inline-flex items-center gap-1"><Wine className="h-3 w-3 text-toast" />{pitch.toastCount}</span>
                      <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-roast" />{pitch.roastCount}</span>
                      <span>{formatDate(pitch.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </section>
        ) : (
          <EmptyState
            title={activeTab === 'best' ? 'No final take selected yet' : 'No pitches yet'}
            body={activeTab === 'best' ? 'Join a pitch sprint and submit your strongest take.' : 'Record your first pitch to start building your portfolio.'}
          />
        )}
      </main>
    </div>
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
