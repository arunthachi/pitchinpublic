import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertCircle, ArrowLeft, CheckCircle2, MessageSquareText, Trophy, UserRound, Video } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { createClient } from '@/lib/supabase/server';
import {
  getPitchFeedbackAskFromFields,
  getPitchStartupNameFromFields,
  getTakeLabelFromFields,
} from '@/lib/pitch-copy';

export const metadata: Metadata = {
  title: 'Founder Access Admin | Pitch in Public',
  description: 'Read-only operator dashboard for early founder access.',
};

interface PitchRow {
  id: string;
  user_id: string;
  hook: string;
  description: string | null;
  startup_name?: string | null;
  one_line_pitch?: string | null;
  feedback_ask?: string | null;
  extra_context?: string | null;
  take_version?: number | null;
  duration: number | null;
  version_number?: number | null;
  is_best_take?: boolean | null;
  created_at: string;
  roast_count?: number | null;
  toast_count?: number | null;
  profiles?:
    | {
    id: string;
    full_name: string | null;
    email?: string | null;
    avatar_url?: string | null;
    username?: string | null;
      }
    | Array<{
        id: string;
        full_name: string | null;
        email?: string | null;
        avatar_url?: string | null;
        username?: string | null;
      }>
    | null;
  feedback?: Array<{
    id: string;
    type: string;
    created_at: string;
  }>;
}

interface FounderSummary {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  pitches: PitchRow[];
  feedbackCount: number;
  hasBestTake: boolean;
  latestPitchAt: string | null;
}

function isAllowedAdmin(email?: string | null) {
  const raw = process.env.PILOT_ADMIN_EMAILS || process.env.NEXT_PUBLIC_PILOT_ADMIN_EMAILS || '';
  const allowlist = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.length) return true;
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

function groupByFounder(pitches: PitchRow[]) {
  const founders = new Map<string, FounderSummary>();

  pitches.forEach((pitch) => {
    const profile = Array.isArray(pitch.profiles) ? pitch.profiles[0] : pitch.profiles;
    const key = pitch.user_id;
    const current = founders.get(key) || {
      userId: key,
      name: profile?.full_name || 'Founder',
      email: profile?.email || '',
      avatar: profile?.avatar_url || '',
      pitches: [],
      feedbackCount: 0,
      hasBestTake: false,
      latestPitchAt: null,
    };

    current.pitches.push(pitch);
    current.feedbackCount += pitch.feedback?.length || 0;
    current.hasBestTake = current.hasBestTake || Boolean(pitch.is_best_take);
    current.latestPitchAt = current.latestPitchAt && new Date(current.latestPitchAt) > new Date(pitch.created_at)
      ? current.latestPitchAt
      : pitch.created_at;
    founders.set(key, current);
  });

  return [...founders.values()].sort((a, b) => {
    const aTime = a.latestPitchAt ? new Date(a.latestPitchAt).getTime() : 0;
    const bTime = b.latestPitchAt ? new Date(b.latestPitchAt).getTime() : 0;
    return bTime - aTime;
  });
}

function formatDate(value?: string | null) {
  if (!value) return 'No pitch yet';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusForFounder(founder: FounderSummary) {
  if (!founder.pitches.length) return { label: 'Needs first take', tone: 'warn' };
  if (founder.pitches.length === 1) return { label: 'Needs better take', tone: 'mid' };
  if (!founder.hasBestTake) return { label: 'Needs best take', tone: 'mid' };
  return { label: 'Ready to share', tone: 'ready' };
}

async function loadPitches() {
  const supabase = await createClient();
  const result = await supabase
    .from('pitches')
    .select(
      `
      id,
      user_id,
      hook,
      description,
      startup_name,
      one_line_pitch,
      feedback_ask,
      extra_context,
      take_version,
      duration,
      version_number,
      is_best_take,
      created_at,
      roast_count,
      toast_count,
      profiles:user_id (
        id,
        full_name,
        email,
        avatar_url,
        username
      ),
      feedback (
        id,
        type,
        created_at
      )
    `
    )
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!result.error) return ((result.data || []) as unknown) as PitchRow[];

  if (/startup_name|one_line_pitch|feedback_ask|extra_context|take_version|is_best_take|deleted_at|schema cache|Could not find/i.test(result.error.message || '')) {
    const fallback = await supabase
      .from('pitches')
      .select(
        `
        id,
        user_id,
        hook,
        description,
        duration,
        version_number,
        created_at,
        roast_count,
        toast_count,
        profiles:user_id (
          id,
          full_name,
          email,
          avatar_url,
          username
        ),
        feedback (
          id,
          type,
          created_at
        )
      `
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!fallback.error) return ((fallback.data || []) as unknown) as PitchRow[];
  }

  throw result.error;
}

export default async function FounderAccessAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AdminShell>
        <EmptyGate
          title="Sign in required"
          body="Open the founder app and sign in, then come back to this admin dashboard."
          ctaHref="/?alpha=1&preview=1"
          ctaLabel="Open app"
        />
      </AdminShell>
    );
  }

  if (!isAllowedAdmin(user.email)) {
    return (
      <AdminShell>
        <EmptyGate
          title="Not on the founder access admin list"
          body="Set PILOT_ADMIN_EMAILS to allow specific operators, or leave it unset for internal local testing."
          ctaHref="/"
          ctaLabel="Back to app"
        />
      </AdminShell>
    );
  }

  let pitches: PitchRow[] = [];
  let loadError = '';

  try {
    pitches = await loadPitches();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Could not load founder access data.';
  }

  const founders = groupByFounder(pitches);
  const firstTakes = founders.filter((founder) => founder.pitches.length >= 1).length;
  const betterTakes = founders.filter((founder) => founder.pitches.length >= 2).length;
  const bestTakes = founders.filter((founder) => founder.hasBestTake).length;
  const feedbackCount = founders.reduce((sum, founder) => sum + founder.feedbackCount, 0);

  return (
    <AdminShell>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Founders with pitches', value: firstTakes, icon: UserRound },
          { label: 'Second takes', value: betterTakes, icon: Video },
          { label: 'Best takes', value: bestTakes, icon: Trophy },
          { label: 'Feedback notes', value: feedbackCount, icon: MessageSquareText },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card rounded-3xl p-5">
              <Icon className="mb-4 h-5 w-5 text-neon-cyan" />
              <p className="font-heading text-4xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </section>

      {loadError ? (
        <div className="mt-6 rounded-3xl border border-roast/30 bg-roast/10 p-5 text-roast">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-5 w-5" />
            Could not load founder access data
          </div>
          <p className="mt-2 text-sm text-red-100">{loadError}</p>
        </div>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-lime">Operator view</p>
          <h2 className="mt-2 font-heading text-3xl font-black">Founder access tracker</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Use this manually to see who posted, who needs a second take, who needs feedback, and who has a Best Take.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {founders.length ? founders.map((founder) => {
            const status = statusForFounder(founder);
            return (
              <article key={founder.userId} className="grid gap-5 p-5 lg:grid-cols-[260px_1fr]">
                <div>
                  <div className="flex items-center gap-3">
                    <img
                      src={founder.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(founder.name)}`}
                      alt={founder.name}
                      className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
                    />
                    <div className="min-w-0">
                      <Link href={`/profile/${founder.userId}`} className="truncate font-heading text-lg font-bold text-white hover:text-neon-cyan">
                        {founder.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{founder.email || founder.userId}</p>
                    </div>
                  </div>
                  <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                    status.tone === 'ready'
                      ? 'bg-neon-lime/15 text-neon-lime'
                      : status.tone === 'warn'
                        ? 'bg-roast/15 text-roast'
                        : 'bg-neon-cyan/15 text-neon-cyan'
                  }`}>
                    {status.label}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">Latest: {formatDate(founder.latestPitchAt)}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {founder.pitches.map((pitch) => (
                    <div key={pitch.id} className="rounded-2xl border border-white/10 bg-black/24 p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                          pitch.is_best_take ? 'bg-neon-lime text-slate-950' : 'bg-white/10 text-slate-300'
                        }`}>
                          {getTakeLabelFromFields(pitch)}
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                          {pitch.feedback?.length || 0} feedback
                        </span>
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-neon-cyan">
                        {getPitchStartupNameFromFields(pitch, 'Startup')}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-white">{pitch.hook}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                        Ask: {getPitchFeedbackAskFromFields(pitch)}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>{formatDate(pitch.created_at)}</span>
                        <span>{pitch.duration || 60}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          }) : (
            <div className="p-10 text-center">
              <p className="font-heading text-2xl font-bold text-white">No founder pitches yet</p>
              <p className="mt-2 text-slate-400">Invite founders to record their First Take.</p>
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/founders" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="font-heading text-base font-bold leading-none">Pitch in Public</p>
              <p className="mt-1 text-xs text-slate-400">Founder access admin</p>
            </div>
          </Link>
          <Link href="/founders" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-200 hover:border-neon-cyan hover:text-neon-cyan">
            <ArrowLeft className="h-4 w-4" />
            Founders page
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function EmptyGate({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="font-heading text-3xl font-black text-white">{title}</h1>
      <p className="mt-3 leading-7 text-slate-400">{body}</p>
      <Link href={ctaHref} className="cta-primary mt-6 inline-flex rounded-full px-5 py-3 font-heading font-bold">
        {ctaLabel}
      </Link>
    </div>
  );
}
