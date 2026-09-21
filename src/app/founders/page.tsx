import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  FileText,
  Flag,
  LockKeyhole,
  MessageSquareText,
  Repeat2,
  Target,
  Trophy,
} from 'lucide-react';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';
import { FaqSection } from '@/components/marketing/FaqSection';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { WorkflowIllustration, type WorkflowStep } from '@/components/marketing/WorkflowIllustration';
import { marketingRoutes } from '@/lib/marketing-content';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';
import { appUrlFor } from '@/lib/site-urls';
import { buildMarketingStructuredData } from '@/lib/structured-data';

export const metadata = buildMarketingMetadata('founders');

const founderLoop: WorkflowStep[] = [
  {
    label: 'Understand',
    title: 'See the standard for this event',
    description: 'Review the pitch criteria and the event’s one-to-six-minute duration before recording.',
  },
  {
    label: 'Prepare',
    title: 'Build a focused Pitch Plan',
    description: 'Turn the standard into the specific ideas, evidence, and ask your pitch needs to cover.',
  },
  {
    label: 'Revise',
    title: 'Use human feedback on the next take',
    description: 'Review observations and concrete next steps tied to the event criteria.',
  },
  {
    label: 'Submit',
    title: 'Choose your Best Take',
    description: 'Select the take that best represents your current pitch when it is time to submit.',
  },
];

export default function FoundersPage() {
  return (
    <div className="min-h-dvh bg-[#05070a] text-white">
      <JsonLd data={buildMarketingStructuredData('founders')} />
      <MarketingHeader audience="founder" currentPath="/founders" ctaSource="founders-header" />
      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_4%,rgba(0,230,246,0.18),transparent_32rem),radial-gradient(circle_at_82%_12%,rgba(183,255,42,0.1),transparent_28rem)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-neon-lime/25 bg-neon-lime/10 px-4 py-2 text-sm font-black text-neon-lime">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Invite-only founder preparation
              </p>
              <h1 className="mt-6 max-w-4xl text-balance font-heading text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
                Know what your event expects before you step on stage.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Turn the event standard into a focused plan, practice in its controlled cohort, use human feedback to revise, and choose your Best Take.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LeadCaptureModal
                  type="founder"
                  triggerLabel="Request founder access"
                  source="founders-hero"
                  triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-black"
                />
                <a href={appUrlFor('/?signin=1')} className="btn-glass inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-bold">
                  Already invited? Sign in
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
              </div>
            </div>
            <WorkflowIllustration steps={founderLoop} caption="Illustrative founder preparation workflow" />
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">Your preparation arc</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Move from expectations to a submission you choose.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Target, title: 'Pitch Standard', body: 'See what the event wants founders to address, how the pitch will be reviewed, and how long it should run.' },
                { icon: Flag, title: 'Pitch Plan', body: 'Organize the points, evidence, and ask you need to communicate before you begin another take.' },
                { icon: MessageSquareText, title: 'Criterion-bound feedback', body: 'Receive human observations and concrete next steps connected to the standard—not a generic score.' },
                { icon: Repeat2, title: 'Next take', body: 'Apply the feedback that is useful, record again, and keep the preparation history in context.' },
                { icon: Trophy, title: 'Best Take', body: 'Mark the version that best represents your pitch and use it for the event’s final submission.' },
                { icon: FileText, title: 'Pitch deck', body: 'Keep a private deck available to authorized participants in the event workflow.' },
              ].map(({ icon: Icon, title, body }) => (
                <article key={title} className="glass-card rounded-[1.5rem] p-6">
                  <Icon className="h-7 w-7 text-neon-cyan" aria-hidden="true" />
                  <h3 className="mt-5 font-heading text-2xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-slate-950/60 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">Two ways to practice</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Prepare for the event. Build the habit between events.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                Event preparation and daily solo practice support different jobs. One is tied to a program’s standard and submission process; the other helps you keep rehearsing consistently.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[1.5rem] border border-neon-cyan/20 bg-neon-cyan/[0.06] p-6">
                <CalendarCheck2 className="h-7 w-7 text-neon-cyan" aria-hidden="true" />
                <h3 className="mt-5 font-heading text-2xl font-black">Event preparation</h3>
                <p className="mt-3 leading-7 text-slate-300">
                  Follow the event standard, work inside its controlled cohort, and prepare a final submission for the organizer.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-neon-lime/20 bg-neon-lime/[0.05] p-6">
                <Repeat2 className="h-7 w-7 text-neon-lime" aria-hidden="true" />
                <h3 className="mt-5 font-heading text-2xl font-black">Daily solo practice</h3>
                <p className="mt-3 leading-7 text-slate-300">
                  Use prompts, goals, reps, streaks, and readiness reflection to keep your pitch practice moving.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 sm:p-9">
              <LockKeyhole className="h-8 w-8 text-neon-lime" aria-hidden="true" />
              <h2 className="mt-6 font-heading text-3xl font-black">Practice visibility is contextual.</h2>
              <p className="mt-4 leading-8 text-slate-300">
                An event’s access and sharing settings determine who can see event takes. Broader public sharing is a separate choice controlled by the founder when the take is eligible.
              </p>
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">The practical outcome</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Arrive with a pitch you have actually rehearsed against the brief.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Pitch in Public does not promise a winning pitch. It gives you a clearer standard, an organized place to practice, and useful human input before the moment matters.
              </p>
            </div>
          </div>
        </section>

        <FaqSection items={marketingRoutes.founders.faq} title="Founder access and practice questions." />

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="glass-panel mx-auto max-w-5xl rounded-[2rem] px-6 py-12 text-center sm:px-10">
            <h2 className="text-balance font-heading text-3xl font-black sm:text-5xl">Prepare your next take with a clearer plan.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Request founder access, or sign in with the email connected to your invitation.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <LeadCaptureModal
                type="founder"
                triggerLabel="Request founder access"
                source="founders-final-cta"
                triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-7 py-4 font-heading font-black"
              />
              <a href={appUrlFor('/?signin=1')} className="btn-glass inline-flex items-center justify-center px-7 py-4 font-heading font-bold">
                Sign in to the app
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Running a program? <Link href="/for-events" className="font-bold text-neon-cyan hover:text-white">Explore organizer preparation.</Link>
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
