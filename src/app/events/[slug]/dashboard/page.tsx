'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, Copy, ExternalLink, MessageSquareText, Play, Sparkles, Trophy, Users, Video } from 'lucide-react';

function readinessFromSubmission(submission: any) {
  const feedback = submission.pitch?.feedback || [];
  if (!feedback.length) return 0;
  const values = feedback.map((item: any) => {
    try {
      const parsed = JSON.parse(item.content || '{}');
      return parsed.readiness || 2;
    } catch {
      return 2;
    }
  });
  return Math.round((values.reduce((sum: number, value: number) => sum + value, 0) / values.length) * 10) / 10;
}

function readinessLabel(value: number) {
  if (!value) return 'No notes';
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

export default function EventDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/events/${slug}`);
    const data = await response.json();
    setState(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const event = state?.event;
  const participants = useMemo(() => state?.participants || [], [state?.participants]);
  const submissions = useMemo(() => state?.submissions || [], [state?.submissions]);
  const founderCount = participants.filter((item: any) => item.role === 'founder').length;
  const feedbackCount = submissions.reduce((sum: number, item: any) => sum + (item.pitch?.feedback?.length || 0), 0);
  const inviteUrl = typeof window !== 'undefined' && event ? `${window.location.origin}/events/${event.slug}` : '';
  const sortedSubmissions = useMemo(
    () => [...submissions].sort((a, b) => readinessFromSubmission(b) - readinessFromSubmission(a)),
    [submissions]
  );

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white">Loading room control...</div>;
  }

  if (!state?.success || !event) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white">Event not found.</div>;
  }

  if (!state.isOrganizer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-bold">Organizer access only.</h1>
        <Link href={`/events/${slug}`} className="mt-5 rounded-xl bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
          Open founder view
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="glass-pill mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
                <Sparkles className="h-4 w-4" />
                Room Control
              </div>
              <h1 className="font-heading text-5xl font-black leading-tight sm:text-6xl">{event.name}</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                Track founder reps, final takes, and readiness before pitch day.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={copyInvite} className="glass-pill inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-heading font-bold text-white">
                <Copy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy invite'}
              </button>
              <Link href={`/events/${slug}`} className="cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-heading font-bold">
                Founder view
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric icon={Users} label="Founders" value={founderCount} />
            <Metric icon={Trophy} label="Final takes" value={submissions.length} />
            <Metric icon={MessageSquareText} label="Coach notes" value={feedbackCount} />
            <Metric icon={Video} label="Pitch length" value={`${event.pitch_length_seconds}s`} />
            <Metric icon={CalendarDays} label="Pitch day" value={new Date(`${event.event_date}T12:00:00`).toLocaleDateString()} />
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
          <div className="glass-card rounded-[2rem] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-lime">Participants</p>
            <div className="mt-4 space-y-3">
              {participants.length ? participants.map((participant: any) => (
                <div key={participant.id} className="flex items-center gap-3 rounded-2xl bg-black/30 p-3">
                  <img
                    src={participant.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
                    alt={participant.profile?.full_name || 'Founder'}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{participant.profile?.full_name || 'Founder'}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{participant.role}</p>
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl bg-black/30 p-4 text-sm text-slate-400">No participants yet.</p>
              )}
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Ready Board</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedSubmissions.length ? sortedSubmissions.map((submission: any) => {
                const readiness = readinessFromSubmission(submission);
                return (
                  <article key={submission.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/35">
                    <Link href={`/pitch/${submission.pitch_id}`} className="group relative block aspect-[9/16] bg-slate-950">
                      {submission.pitch?.thumbnail_url ? (
                        <img src={submission.pitch.thumbnail_url} alt={submission.pitch.hook} className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Play className="h-10 w-10 text-white/40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      <span className="absolute left-3 top-3 rounded-full bg-neon-lime px-2 py-1 text-xs font-black text-slate-950">Final Take</span>
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="line-clamp-2 font-bold text-white">{submission.pitch?.hook}</p>
                      </div>
                    </Link>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={submission.profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP'}
                          alt={submission.profile?.full_name || 'Founder'}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{submission.profile?.full_name || 'Founder'}</p>
                          <p className="text-xs text-slate-500">{readinessLabel(readiness)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <Mini label="Toast" value={submission.pitch?.toast_count || 0} />
                        <Mini label="Roast" value={submission.pitch?.roast_count || 0} />
                        <Mini label="Notes" value={submission.pitch?.feedback?.length || 0} />
                      </div>
                    </div>
                  </article>
                );
              }) : (
                <p className="rounded-2xl bg-black/30 p-5 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                  No final takes submitted yet. Share the invite link and ask founders to submit from the event page.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <Icon className="mb-3 h-5 w-5 text-neon-cyan" />
      <p className="font-heading text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.05] p-2">
      <p className="font-heading text-lg font-black text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}
