'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck,
  Flame,
  Mail,
  MessageSquareText,
  Mic,
  Repeat2,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { LeadCaptureModal } from './LeadCaptureModal';

interface WelcomeHeroProps {
  showAlphaSignIn?: boolean;
  onAlphaSignIn?: () => void;
  onAlphaPreview?: () => void;
}

const pitchLoop = [
  {
    icon: Mic,
    title: 'Record',
    description: 'Post a focused 60-second elevator pitch without overthinking it.',
  },
  {
    icon: MessageSquareText,
    title: 'Get scored feedback',
    description: 'Collect Toast/Roast reactions, written notes, and 1-10 scores from other builders.',
  },
  {
    icon: Repeat2,
    title: 'Re-pitch',
    description: 'Use the feedback to tighten your next version and make progress visible.',
  },
];

const practiceSignals = [
  {
    title: 'Who is it for?',
    focus: 'Audience',
    prompt: 'Name the exact person you help before you describe the product.',
    sample: 'For solo builders who freeze when someone asks what they do.',
    founderName: 'Maya is recording',
    businessName: 'Founder of NichePilot',
    imageUrl: '/images/landing/pitch-audience-woman.webp',
    imagePosition: '48% center',
    imageSize: 'cover',
    recordingMode: 'Selfie pitch',
    clarityDelta: '+10 clarity',
    feedbackType: 'Toast',
    feedbackNote: 'Clear ICP. Say the customer in the first sentence.',
    scores: [
      { label: 'Clarity', value: '8.4' },
      { label: 'Market', value: '7.8' },
    ],
    stats: [
      { label: 'Streak', value: '5d' },
      { label: 'Clarity', value: '+24' },
      { label: 'Fix', value: 'ICP' },
    ],
  },
  {
    title: 'What problem hurts?',
    focus: 'Problem',
    prompt: 'Lead with the pain, not the feature list.',
    sample: 'They ramble, lose the listener, and leave without a clear next step.',
    founderName: 'Leo is re-pitching',
    businessName: 'Founder of CallSharp',
    imageUrl: '/images/landing/pitch-problem.webp',
    imagePosition: '48% center',
    imageSize: 'cover',
    recordingMode: 'Camera practice',
    clarityDelta: '+12 pain',
    feedbackType: 'Roast',
    feedbackNote: 'The pain is real, but the demo still sounds like a feature tour.',
    scores: [
      { label: 'Clarity', value: '6.9' },
      { label: 'Problem', value: '8.1' },
    ],
    stats: [
      { label: 'Streak', value: '7d' },
      { label: 'Clarity', value: '+28' },
      { label: 'Fix', value: 'Pain' },
    ],
  },
  {
    title: 'Why should anyone care now?',
    focus: 'Urgency',
    prompt: 'Explain why this problem matters today, not someday.',
    sample: 'Every demo, intro, and customer call depends on a sharp first minute.',
    founderName: 'Priya is practicing',
    businessName: 'Founder of LaunchSignal',
    imageUrl: '/images/landing/pitch-urgency-stage-woman.webp',
    imagePosition: '50% center',
    imageSize: 'auto 128%',
    recordingMode: 'Demo room pitch',
    clarityDelta: '+15 urgency',
    feedbackType: 'Toast',
    feedbackNote: 'The timing lands. Add one proof point before the ask.',
    scores: [
      { label: 'Clarity', value: '8.7' },
      { label: 'Timing', value: '8.9' },
    ],
    stats: [
      { label: 'Streak', value: '9d' },
      { label: 'Clarity', value: '+31' },
      { label: 'Fix', value: 'Now' },
    ],
  },
  {
    title: 'What is the ask?',
    focus: 'Ask',
    prompt: 'End with the next action you want from the listener.',
    sample: 'Give feedback, join the beta, or introduce one founder who needs this.',
    founderName: 'Ava is refining',
    businessName: 'Founder of BuildLoop',
    imageUrl: '/images/landing/pitch-ask.webp',
    imagePosition: '50% center',
    imageSize: 'cover',
    recordingMode: 'CTA take',
    clarityDelta: '+9 ask',
    feedbackType: 'Roast',
    feedbackNote: 'Good close, but the ask is too broad. Pick one next step.',
    scores: [
      { label: 'Clarity', value: '7.6' },
      { label: 'Ask', value: '6.8' },
    ],
    stats: [
      { label: 'Streak', value: '6d' },
      { label: 'Clarity', value: '+22' },
      { label: 'Fix', value: 'Ask' },
    ],
  },
];

export function WelcomeHero({ showAlphaSignIn = false, onAlphaSignIn, onAlphaPreview }: WelcomeHeroProps) {
  const [activeSignal, setActiveSignal] = useState(practiceSignals[0]);
  const [waitlistEmail, setWaitlistEmail] = useState('');

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="font-heading text-base font-bold leading-none">Pitch in Public</p>
              <p className="mt-1 text-xs text-slate-400">Daily pitch practice for founders</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pilot"
              className="hidden rounded-lg border border-neon-lime/25 bg-neon-lime/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-neon-lime transition hover:border-neon-lime hover:bg-neon-lime/15 sm:inline-flex"
            >
              For founders
            </Link>
            <Link
              href="/for-events"
              className="hidden rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:inline-flex"
            >
              For organizers
            </Link>
            {showAlphaSignIn && (
              <>
                <Link
                  href="/?alpha=1&preview=1"
                  onClick={() => {
                    onAlphaPreview?.();
                  }}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Preview
                </Link>
                <button
                  type="button"
                  onClick={onAlphaSignIn}
                  className="cta-primary px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Founder alpha
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(90deg,rgba(0,0,0,0.92),rgba(0,0,0,0.76)_42%,rgba(0,0,0,0.35)),url('https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1800&q=80')] bg-cover bg-center pt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-16 lg:pt-16">
            <div className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mb-6 inline-flex w-fit items-center gap-2 rounded-lg border border-neon-lime/30 bg-neon-lime/10 px-3 py-2 text-sm font-semibold text-neon-lime"
              >
                <Zap className="h-4 w-4" aria-hidden="true" />
                Early access opens soon at pitchinpublic.io
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.4 }}
                className="max-w-4xl text-balance font-heading text-5xl font-bold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl"
              >
                Sharpen your founder pitch in 60 seconds a day.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.4 }}
                className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl"
              >
                Record your elevator pitch, get Toast/Roast reactions plus written
                comments and clarity scores from other builders, then tighten the next
                version before the room checks out.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                className="mt-8 max-w-xl"
              >
                  <div className="rounded-xl border border-white/10 bg-black/45 p-2 shadow-2xl shadow-black/25 backdrop-blur">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label htmlFor="waitlist-email" className="sr-only">
                        Email address
                      </label>
                      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                        <Mail className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                        <input
                          id="waitlist-email"
                          type="email"
                          value={waitlistEmail}
                          onChange={(event) => {
                            setWaitlistEmail(event.target.value);
                          }}
                          placeholder="you@company.com"
                          autoComplete="email"
                          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                          required
                        />
                      </div>
                      <LeadCaptureModal
                        type="founder"
                        triggerLabel="Join waitlist"
                        initialEmail={waitlistEmail}
                        source="landing-hero"
                        triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-6 py-3 font-heading font-bold transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      />
                    </div>
                  </div>

                <div className="mt-3 text-sm text-slate-400">
                  <p>Email first. Startup details open in a quick in-app form.</p>
                  <p className="mt-2">
                    Questions or pilot interest?{' '}
                    <a
                      href="mailto:hello@pitchinpublic.io"
                      className="font-semibold text-neon-cyan transition hover:text-white"
                    >
                      hello@pitchinpublic.io
                    </a>
                  </p>
                </div>
              </motion.div>

              <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                {practiceSignals.map((signal) => (
                  <button
                    key={signal.title}
                    type="button"
                    aria-pressed={activeSignal.title === signal.title}
                    onClick={() => setActiveSignal(signal)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                      activeSignal.title === signal.title
                        ? 'border-neon-cyan bg-neon-cyan/15 text-white'
                        : 'border-white/10 bg-black/35 text-slate-300 hover:border-neon-cyan/50 hover:text-white'
                    }`}
                  >
                    {signal.title}
                  </button>
                ))}
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                {activeSignal.prompt}
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="mx-auto aspect-[9/19.5] h-[74vh] max-h-[660px] min-h-[480px] w-auto lg:ml-auto"
            >
              <div className="relative h-full rounded-[2.4rem] border border-white/15 bg-slate-950 p-2.5 shadow-2xl shadow-neon-cyan/10">
                <div className="pointer-events-none absolute left-1/2 top-4 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-950/80" />
                <div className="h-full overflow-hidden rounded-[1.9rem] border border-white/10 bg-black">
                  <motion.div
                    key={activeSignal.title}
                    initial={{ opacity: 0.72, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.24 }}
                    className="relative h-full bg-cover"
                    style={{
                      backgroundImage: `linear-gradient(160deg,rgba(0,230,246,0.18),rgba(5,7,10,0.22) 30%,rgba(0,0,0,1) 72%),url('${activeSignal.imageUrl}')`,
                      backgroundPosition: activeSignal.imagePosition,
                      backgroundSize: activeSignal.imageSize,
                    }}
                  >
                    <div className="absolute inset-0 bg-black/35" />
                    <div className="absolute left-4 right-4 top-6 flex items-center justify-between">
                      <span className="rounded-md bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                        {activeSignal.recordingMode}
                      </span>
                      <span className="rounded-md bg-neon-lime px-2.5 py-1 text-[11px] font-bold text-slate-950">
                        {activeSignal.clarityDelta}
                      </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-20">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-cyan text-slate-950">
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-heading text-sm font-bold">
                            {activeSignal.founderName}
                          </p>
                          <p className="truncate text-xs text-slate-300">
                            {activeSignal.businessName}
                          </p>
                        </div>
                      </div>

                      <p className="text-lg font-bold leading-tight">
                        &ldquo;{activeSignal.sample}&rdquo;
                      </p>

                      <div className="mt-3 rounded-xl border border-white/15 bg-black/45 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neon-cyan/90 text-slate-950">
                              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                                Builder feedback
                              </p>
                              <p className="truncate text-[11px] font-semibold text-white">
                                {activeSignal.feedbackType} with notes
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            {activeSignal.scores.map((score) => (
                              <div key={score.label} className="rounded-md bg-white/10 px-2 py-1.5 text-right">
                                <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">{score.label}</p>
                                <p className="text-[11px] font-bold leading-tight text-white">{score.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="line-clamp-2 text-[11px] font-medium leading-4 text-white">
                          &ldquo;{activeSignal.feedbackNote}&rdquo;
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {activeSignal.stats.map((stat) => (
                          <div key={stat.label} className="min-w-0 rounded-lg bg-white/10 p-2.5 backdrop-blur">
                            <p className="truncate text-[10px] leading-tight text-slate-300">{stat.label}</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="absolute right-3 top-[38%] flex -translate-y-1/2 flex-col gap-3">
                      <div className="relative flex h-12 w-12 flex-col items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl before:absolute before:inset-x-2 before:top-1 before:h-3 before:rounded-full before:bg-white/20 before:blur-sm">
                        <Flame className="relative h-4 w-4 text-roast" aria-hidden="true" />
                        <span className="relative text-[9px] font-bold text-white/90">Roast</span>
                      </div>
                      <div className="relative flex h-12 w-12 flex-col items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl before:absolute before:inset-x-2 before:top-1 before:h-3 before:rounded-full before:bg-white/20 before:blur-sm">
                        <Trophy className="relative h-4 w-4 text-toast" aria-hidden="true" />
                        <span className="relative text-[9px] font-bold text-white/90">Toast</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">
                The real founder problem
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white sm:text-4xl">
                Most builders do not need more attention first. They need a clearer
                pitch.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'You ramble under pressure',
                  description:
                    'The product makes sense in your head, then turns into a long feature tour out loud.',
                },
                {
                  title: 'People miss the point',
                  description:
                    'They nod politely, but they cannot repeat who it is for or why it matters.',
                },
                {
                  title: 'You do not get enough reps',
                  description:
                    'A pitch gets better through deliberate practice, not one rewrite before demo day.',
                },
              ].map((pain) => (
                <div key={pain.title} className="rounded-lg border border-white/10 bg-black p-5">
                  <Target className="mb-5 h-6 w-6 text-neon-lime" aria-hidden="true" />
                  <h3 className="font-heading text-xl font-bold text-white">{pain.title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{pain.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-black px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-lime">
                Daily training loop
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white sm:text-4xl">
                Build the habit before you need the room.
              </h2>
              <p className="mt-4 leading-8 text-slate-300">
                Pitch in Public turns founder communication into a repeatable practice
                loop: one minute, useful feedback, visible improvement.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {pitchLoop.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div key={step.title} className="rounded-lg border border-white/10 bg-slate-950 p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                        <Icon className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
                      </div>
                      <span className="font-heading text-sm font-bold text-slate-500">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="font-heading text-xl font-bold text-white">{step.title}</h3>
                    <p className="mt-3 leading-7 text-slate-400">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {[
              {
                icon: CalendarCheck,
                title: 'Daily nudges',
                description: 'Keep a pitch streak and get prompted to improve one part of your message each day.',
              },
              {
                icon: Trophy,
                title: 'Most improved wins',
                description: 'Competitions can reward sharper v2 pitches, not just the loudest first version.',
              },
              {
                icon: Users,
                title: 'Event-ready rooms',
                description: 'Use pitch rooms for speed networking, demo nights, and founder feedback circles.',
              },
            ].map((feature) => {
              const Icon = feature.icon;

              return (
                <div key={feature.title} className="rounded-lg border border-white/10 bg-black p-5">
                  <Icon className="mb-5 h-6 w-6 text-neon-cyan" aria-hidden="true" />
                  <h3 className="font-heading text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/10 bg-black px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">
                For pitch events
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white sm:text-4xl">
                Give founders reps before demo day, not just a stage on demo day.
              </h2>
              <p className="mt-4 leading-8 text-slate-300">
                Pitch in Public can support competitions, founder meetups, speed networking, and accelerator prep with practice plans, best-take submissions, and constructive feedback loops.
              </p>
              <Link
                href="/for-events"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/35 bg-neon-cyan/10 px-6 py-3 font-heading font-bold text-neon-cyan transition hover:border-neon-cyan hover:bg-neon-cyan/15"
              >
                Explore organizer pilots
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { value: '01', label: 'Create pitch day' },
                { value: '02', label: 'Nudge daily reps' },
                { value: '03', label: 'Submit best take' },
              ].map((step) => (
                <div key={step.value} className="rounded-lg border border-white/10 bg-black p-5">
                  <p className="font-heading text-3xl font-bold text-neon-lime">{step.value}</p>
                  <p className="mt-4 text-lg font-bold leading-6 text-white">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 p-6 sm:p-8 lg:flex-row lg:items-center">
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">
                pitchinpublic.io
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white">
                Join the first founder practice rooms.
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-slate-300">
                Early members will help shape the pitch loop, event rooms, written comments, and scored Toast/Roast feedback before public launch.
              </p>
              <p className="mt-4 text-sm text-slate-400">
                Questions, event pilots, or founder group interest:{' '}
                <a
                  href="mailto:hello@pitchinpublic.io"
                  className="font-semibold text-neon-cyan transition hover:text-white"
                >
                  hello@pitchinpublic.io
                </a>
              </p>
            </div>
            <LeadCaptureModal
              type="founder"
              triggerLabel="Join waitlist"
              source="landing-bottom"
              triggerClassName="cta-primary inline-flex shrink-0 items-center justify-center gap-2 px-6 py-3 font-heading font-bold transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
