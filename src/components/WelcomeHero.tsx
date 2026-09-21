'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, LockKeyhole, MessageSquareText, Repeat2, Target } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { LeadCaptureModal } from './LeadCaptureModal';

interface WelcomeHeroProps {
  showSignIn?: boolean;
  onSignIn?: () => void;
}

const workflow = [
  {
    icon: Target,
    title: 'Follow the standard',
    description: 'Practice against the pitch criteria defined for your program or event.',
  },
  {
    icon: MessageSquareText,
    title: 'Get useful feedback',
    description: 'Reviewers connect observations and next steps to the criteria that matter.',
  },
  {
    icon: Repeat2,
    title: 'Submit a stronger take',
    description: 'Apply what you learned, record again, and choose your Best Take.',
  },
];

export function WelcomeHero({ showSignIn = false, onSignIn }: WelcomeHeroProps) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Pitch in Public home">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="font-heading text-base font-bold leading-none">Pitch in Public</p>
              <p className="mt-1 text-xs text-slate-400">Guided pitch preparation</p>
            </div>
          </Link>

          {showSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 font-heading text-sm font-bold text-white transition hover:border-neon-cyan hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              Sign in
            </button>
          ) : null}
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,240,255,0.15),transparent_28rem),radial-gradient(circle_at_80%_80%,rgba(204,255,0,0.1),transparent_24rem)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Invite-only access
              </div>
              <h1 className="mt-7 max-w-3xl font-heading text-4xl font-black leading-tight sm:text-6xl">
                Prepare the pitch your next room expects.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Pitch in Public gives founders a clear Pitch Standard, a focused Pitch Plan, and structured human feedback before the final take.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {showSignIn ? (
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="cta-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-heading font-black"
                  >
                    Sign in to your workspace
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                ) : null}
                <LeadCaptureModal
                  type="founder"
                  triggerLabel="Request founder access"
                  source="app-access"
                  triggerClassName="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 font-heading font-black text-white transition hover:border-neon-cyan hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                />
              </div>

              <p className="mt-6 text-sm leading-6 text-slate-400">
                Looking for program or event support?{' '}
                <Link href="/for-events" className="font-bold text-neon-cyan hover:text-white">
                  Explore organizer access
                </Link>
                .
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/12 bg-slate-950/80 p-6 shadow-2xl shadow-neon-cyan/5 backdrop-blur sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-neon-lime">The preparation loop</p>
              <div className="mt-6 space-y-6">
                {workflow.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="flex gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Icon className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="font-heading text-lg font-black">{step.title}</h2>
                        <p className="mt-1 leading-6 text-slate-400">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-neon-lime/20 bg-neon-lime/10 p-4 text-sm leading-6 text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" aria-hidden="true" />
                Event practice stays within the cohort. Founders control whether a pitch is shared publicly.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
