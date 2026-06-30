'use client';

import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Flame,
  Loader2,
  Mail,
  MessageSquareText,
  Mic,
  Play,
  Repeat2,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

interface WelcomeHeroProps {
  onPreviewFeed?: () => void;
}

const pitchLoop = [
  {
    icon: Mic,
    title: 'Record',
    description: 'Post a focused 60-second elevator pitch without overthinking it.',
  },
  {
    icon: MessageSquareText,
    title: 'Get Toast/Roast',
    description: 'Learn what lands, what confuses people, and what needs sharper proof.',
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
    clarityDelta: '+10 audience',
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
    stats: [
      { label: 'Streak', value: '6d' },
      { label: 'Clarity', value: '+22' },
      { label: 'Fix', value: 'Ask' },
    ],
  },
];

export function WelcomeHero({ onPreviewFeed }: WelcomeHeroProps) {
  const [activeSignal, setActiveSignal] = useState(practiceSignals[0]);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const [founderAccessStatus, setFounderAccessStatus] = useState<'idle' | 'loading' | 'saved' | 'skipped' | 'error'>('idle');
  const [founderAccessMessage, setFounderAccessMessage] = useState('');
  const [founderDetails, setFounderDetails] = useState({
    fullName: '',
    companyName: '',
    websiteOrLinkedIn: '',
  });

  const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWaitlistStatus('loading');
    setWaitlistMessage('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: waitlistEmail,
          source: 'landing-hero',
          referrer: typeof document !== 'undefined' ? document.referrer : null,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not join the waitlist right now.');
      }

      setWaitlistStatus('success');
      setWaitlistMessage(data.message || 'You are on the waitlist.');
      setFounderAccessStatus('idle');
      setFounderAccessMessage('');
    } catch (error) {
      setWaitlistStatus('error');
      setWaitlistMessage(error instanceof Error ? error.message : 'Could not join the waitlist right now.');
    }
  };

  const handleFounderAccessSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFounderAccessStatus('loading');
    setFounderAccessMessage('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: waitlistEmail,
          intent: 'founder_access',
          source: 'landing-founder-access',
          ...founderDetails,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not save founder details right now.');
      }

      setFounderAccessStatus('saved');
      setFounderAccessMessage(data.message || 'Founder access details saved.');
    } catch (error) {
      setFounderAccessStatus('error');
      setFounderAccessMessage(error instanceof Error ? error.message : 'Could not save founder details right now.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-cyan text-slate-950">
              <Mic className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-heading text-base font-bold leading-none">Pitch in Public</p>
              <p className="mt-1 text-xs text-slate-400">Daily pitch practice for founders</p>
            </div>
          </div>

          <span className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Waitlist
          </span>
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
                Record your elevator pitch, get constructive Toast/Roast feedback from
                other builders, and improve your clarity, confidence, and momentum before
                the room checks out.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                className="mt-8 max-w-xl"
              >
                {waitlistStatus === 'success' ? (
                  <div className="rounded-xl border border-neon-cyan/20 bg-black/55 p-4 shadow-2xl shadow-black/25 backdrop-blur">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" aria-hidden="true" />
                      <div>
                        <p className="font-heading text-lg font-bold text-white">You are on the waitlist.</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          Want early founder access?
                        </p>
                      </div>
                    </div>

                    {founderAccessStatus === 'saved' || founderAccessStatus === 'skipped' ? (
                      <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                        {founderAccessMessage || 'Thanks. We will keep you posted.'}
                      </p>
                    ) : (
                      <form onSubmit={handleFounderAccessSubmit} className="mt-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            type="text"
                            value={founderDetails.fullName}
                            onChange={(event) => setFounderDetails((details) => ({ ...details, fullName: event.target.value }))}
                            placeholder="Name"
                            autoComplete="name"
                            className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20"
                          />
                          <input
                            type="text"
                            value={founderDetails.companyName}
                            onChange={(event) => setFounderDetails((details) => ({ ...details, companyName: event.target.value }))}
                            placeholder="Startup / company"
                            autoComplete="organization"
                            className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20"
                          />
                        </div>
                        <input
                          type="url"
                          value={founderDetails.websiteOrLinkedIn}
                          onChange={(event) => setFounderDetails((details) => ({ ...details, websiteOrLinkedIn: event.target.value }))}
                          placeholder="Website or LinkedIn URL"
                          autoComplete="url"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="submit"
                            disabled={founderAccessStatus === 'loading'}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-neon-lime px-5 py-3 font-heading font-bold text-slate-950 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                          >
                            {founderAccessStatus === 'loading' ? (
                              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                            ) : (
                              <ArrowRight className="h-5 w-5" aria-hidden="true" />
                            )}
                            Request early access
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFounderAccessStatus('skipped');
                              setFounderAccessMessage('No problem. You are on the waitlist.');
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-5 py-3 font-heading font-bold text-white transition-colors hover:border-white/30 hover:bg-white/10"
                          >
                            Skip
                          </button>
                        </div>
                        {founderAccessMessage && (
                          <p className={`text-sm ${founderAccessStatus === 'error' ? 'text-red-300' : 'text-slate-300'}`}>
                            {founderAccessMessage}
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleWaitlistSubmit} className="rounded-xl border border-white/10 bg-black/45 p-2 shadow-2xl shadow-black/25 backdrop-blur">
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
                            if (waitlistStatus !== 'idle') {
                              setWaitlistStatus('idle');
                              setWaitlistMessage('');
                            }
                          }}
                          placeholder="you@company.com"
                          autoComplete="email"
                          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={waitlistStatus === 'loading'}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-neon-cyan px-6 py-3 font-heading font-bold text-slate-950 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      >
                        {waitlistStatus === 'loading' ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        ) : (
                        <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        )}
                        Join waitlist
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-3 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center">
                  <p>
                    {waitlistStatus === 'success'
                      ? founderAccessStatus === 'saved' || founderAccessStatus === 'skipped'
                        ? 'Thanks. We will keep you posted as early access opens.'
                        : 'Add optional founder details for early access, or skip.'
                      : waitlistMessage ||
                      'Get early access when the MVP opens for founders and event hosts.'}
                  </p>
                  <button
                    type="button"
                    onClick={onPreviewFeed}
                    className="inline-flex w-fit items-center gap-2 font-semibold text-white transition-colors hover:text-neon-cyan"
                  >
                    Preview founder feed
                    <Play className="h-4 w-4" aria-hidden="true" />
                  </button>
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
                      backgroundImage: `linear-gradient(160deg,rgba(0,240,255,0.18),rgba(2,6,23,0.22) 30%,rgba(0,0,0,1) 72%),url('${activeSignal.imageUrl}')`,
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

                      <div className="mt-4 grid grid-cols-3 gap-2">
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
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 p-6 sm:p-8 lg:flex-row lg:items-center">
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">
                pitchinpublic.io
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white">
                Join the first founder practice rooms.
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-slate-300">
                Early members will help shape the pitch loop, event rooms, and Toast/Roast feedback quality before public launch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById('waitlist-email')?.focus()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-neon-cyan px-6 py-3 font-heading font-bold text-slate-950 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Join waitlist
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
