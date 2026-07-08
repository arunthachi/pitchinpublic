import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Medal,
  MessageSquareText,
  Repeat2,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

export const metadata: Metadata = {
  title: 'Pitch in Public for Organizers | Run Better Pitch Practice',
  description:
    'Turn pitch competitions, demo days, cohorts, and founder programs into guided practice sprints with 60-second pitch reps, feedback, and best-take submissions.',
};

const eventTypes = [
  'Pitch competitions',
  'Demo days',
  'Accelerator prep',
  'Founder meetups',
  'Speed networking',
  'Investor office hours',
];

const workflow = [
  {
    icon: CalendarDays,
    title: 'Create the pitch day',
    description:
      'Set the event date, audience, judging lens, and the pitch length founders should practice toward.',
  },
  {
    icon: Repeat2,
    title: 'Nudge daily reps',
    description:
      'Founders get a simple plan: clarify ICP, sharpen pain, prove urgency, close with one ask.',
  },
  {
    icon: MessageSquareText,
    title: 'Collect useful feedback',
    description:
      'Toast what works, Roast what needs work, and add notes that make the next take better.',
  },
  {
    icon: ClipboardCheck,
    title: 'Submit the best take',
    description:
      'Each founder picks one polished pitch for organizers, judges, or the audience to review.',
  },
];

export default function ForEventsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="font-heading text-base font-bold leading-none">Pitch in Public</p>
              <p className="mt-1 text-xs text-slate-400">For Organizers</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan sm:inline-flex"
            >
              Founders
            </Link>
            <a
              href="https://forms.gle/DD6geQhkm3T7WsLA6"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300"
            >
              Early access
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(0,230,246,0.14),transparent_34%),linear-gradient(180deg,rgba(183,255,42,0.1),transparent_42%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-24">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-lg border border-neon-lime/30 bg-neon-lime/10 px-3 py-2 text-sm font-semibold text-neon-lime">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Pitch competitions, demo days, founder rooms
              </div>
              <h1 className="max-w-4xl text-balance font-heading text-5xl font-bold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
                Turn your founder program into a pitch practice sprint.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Most pitch events, cohorts, and founder programs judge the final minute. Pitch in Public helps founders
                practice the weeks before, collect constructive feedback, and submit one
                stronger take when it matters.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="https://forms.gle/DD6geQhkm3T7WsLA6"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-neon-cyan px-6 py-3 font-heading font-bold text-slate-950 transition-transform hover:scale-[1.02]"
                >
                  Request event pilot
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
                <Link
                  href="/?alpha=1&preview=1"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-6 py-3 font-heading font-bold text-white transition hover:border-neon-cyan hover:text-neon-cyan"
                >
                  Preview founder app
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl">
              <div className="rounded-[2rem] border border-white/15 bg-white/[0.05] p-4 shadow-2xl shadow-neon-cyan/10 backdrop-blur-2xl">
                <div className="rounded-[1.5rem] border border-white/10 bg-black p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-neon-cyan">
                        Local Shark Tank
                      </p>
                      <h2 className="mt-2 font-heading text-2xl font-bold">90-day pitch sprint</h2>
                    </div>
                    <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/10 px-3 py-2 text-right">
                      <p className="text-xs text-slate-300">Pitch day</p>
                      <p className="font-heading text-lg font-bold text-neon-lime">Apr 18</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['Founders', '42'],
                      ['Practice reps', '318'],
                      ['Feedback notes', '926'],
                      ['Best takes ready', '27'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                        <p className="mt-2 font-heading text-3xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-neon-cyan" />
                      <p className="font-heading font-bold">Today&apos;s founder prompt</p>
                    </div>
                    <p className="leading-7 text-slate-200">
                      Record a 60-second take that names the buyer in the first sentence
                      and ends with one ask for the judges.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {['ICP clearer', 'Problem sharper', 'Ask more specific'].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
                        <CheckCircle2 className="h-5 w-5 text-neon-lime" />
                        <span className="font-semibold text-slate-200">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-lime">
                Designed for the rooms where founders need to perform
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
                Use it before, during, and after the event.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {eventTypes.map((type) => (
                <div key={type} className="rounded-lg border border-white/10 bg-black p-5">
                  <Users className="mb-5 h-6 w-6 text-neon-cyan" aria-hidden="true" />
                  <h3 className="font-heading text-xl font-bold">{type}</h3>
                  <p className="mt-3 leading-7 text-slate-400">
                    Give participants a guided practice loop before they pitch live.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-black px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">
                Event workflow
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
                The first product wedge is preparation, not another event directory.
              </h2>
              <p className="mt-4 leading-8 text-slate-300">
                Organizers get better pitches. Founders get reps. Judges get a cleaner
                final take and a feedback trail that shows improvement.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-lg border border-white/10 bg-slate-950 p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                        <Icon className="h-5 w-5 text-neon-lime" aria-hidden="true" />
                      </span>
                      <span className="font-heading text-sm font-bold text-slate-500">0{index + 1}</span>
                    </div>
                    <h3 className="font-heading text-xl font-bold">{step.title}</h3>
                    <p className="mt-3 leading-7 text-slate-400">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black p-6 sm:p-8">
              <Target className="mb-5 h-8 w-8 text-neon-cyan" aria-hidden="true" />
              <h2 className="font-heading text-3xl font-bold">For founders</h2>
              <p className="mt-4 leading-8 text-slate-300">
                Create a pitch goal, practice daily, and pick the best take for the
                event. The app rewards improvement, not just posting.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black p-6 sm:p-8">
              <Medal className="mb-5 h-8 w-8 text-neon-lime" aria-hidden="true" />
              <h2 className="font-heading text-3xl font-bold">For organizers</h2>
              <p className="mt-4 leading-8 text-slate-300">
                Run a preparation sprint, collect submissions, and make your event
                feel higher quality before anyone walks on stage.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 p-6 sm:p-8 lg:flex-row lg:items-center">
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-neon-cyan">
                Event pilots
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold">
                Bring Pitch in Public to your next founder room.
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-slate-300">
                We are selecting early pitch competitions, community events, and demo
                days to shape the event workflow.
              </p>
            </div>
            <a
              href="https://forms.gle/DD6geQhkm3T7WsLA6"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-neon-cyan px-6 py-3 font-heading font-bold text-slate-950 transition-transform hover:scale-[1.02]"
            >
              Request pilot
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
