import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, LockKeyhole, MessageSquareText, Repeat2, ShieldCheck, Trophy, Video } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';

export const metadata: Metadata = {
  title: 'For Founders | Pitch in Public',
  description:
    'Record a 60-second founder pitch, get structured Roast/Toast feedback, improve it, and choose your Best Take.',
};

const mustHave = [
  'Startup name',
  'One-line pitch',
  '60-second vertical pitch video',
  'Specific feedback ask',
];

const weeks = [
  {
    title: 'Week 1: First Take',
    body: 'Record the rough version. Builders respond on clarity, customer, problem, and confidence.',
    icon: Video,
  },
  {
    title: 'Week 2: Better Take',
    body: 'Record the improved version. Compare signals, tighten the message, and mark your Best Take.',
    icon: Repeat2,
  },
  {
    title: 'Best Take',
    body: 'Choose the version you would share with a judge, customer, investor, or founder community.',
    icon: Trophy,
  },
];

export default function FoundersPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="font-heading text-base font-bold leading-none">Pitch in Public</p>
              <p className="mt-1 text-xs text-slate-400">For Founders</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/?alpha=1&preview=1"
              className="hidden rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan sm:inline-flex"
            >
              Open app
            </Link>
            <LeadCaptureModal
              type="founder"
              triggerLabel="Request invite"
              source="founders-header"
              triggerClassName="inline-flex items-center gap-2 rounded-full bg-neon-cyan px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300"
            />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(0,230,246,0.18),transparent_30rem),radial-gradient(circle_at_74%_4%,rgba(183,255,42,0.12),transparent_28rem)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.86fr] lg:px-8 lg:py-24">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-neon-lime/25 bg-neon-lime/10 px-4 py-2 text-sm font-bold text-neon-lime">
                <LockKeyhole className="h-4 w-4" />
                Invite-only for now · Founder pitch practice
              </div>
              <h1 className="max-w-4xl text-balance font-heading text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                Post your pitch. Get useful feedback. Improve the next take.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Record your first 60-second vertical pitch, get structured Roast/Toast feedback,
                improve it, and choose one stronger Best Take.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LeadCaptureModal
                  type="founder"
                  triggerLabel="Request founder invite"
                  source="founders-hero"
                  triggerClassName="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 font-heading font-black"
                />
                <Link
                  href="/?alpha=1&preview=1"
                  className="btn-glass inline-flex items-center justify-center rounded-full px-6 py-4 font-heading font-bold"
                >
                  Preview the practice room
                </Link>
              </div>
              <p className="mt-4 flex max-w-xl items-start gap-2 text-sm leading-6 text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
                Your rough takes are for practice. You choose which take is worth sharing more broadly.
              </p>
            </div>

            <div className="glass-panel rounded-[2rem] p-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">Core submission</p>
                <h2 className="mt-3 font-heading text-3xl font-black">One useful rep, not a polished ad.</h2>
                <div className="mt-6 space-y-3">
                  {mustHave.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <CheckCircle2 className="h-5 w-5 text-neon-lime" />
                      <span className="font-semibold text-slate-100">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-neon-cyan" />
                    <p className="font-heading font-bold">Feedback format</p>
                  </div>
                  <p className="leading-7 text-slate-300">
                    Toast or Roast, multiple signal chips, optional note, and a simple readiness rating:
                    Needs work, Getting there, Strong, or Pitch-ready.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="font-heading text-sm font-black uppercase tracking-[0.18em] text-neon-lime">
                Founder loop
              </p>
              <h2 className="mt-3 font-heading text-4xl font-black">First Take, Better Take, Best Take.</h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {weeks.map((week) => {
                const Icon = week.icon;
                return (
                  <article key={week.title} className="glass-card rounded-[1.5rem] p-6">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                      <Icon className="h-6 w-6 text-neon-cyan" />
                    </div>
                    <h3 className="font-heading text-2xl font-black">{week.title}</h3>
                    <p className="mt-3 leading-7 text-slate-400">{week.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
