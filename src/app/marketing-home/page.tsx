import Link from 'next/link';
import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  FileVideo,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  UsersRound,
} from 'lucide-react';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';
import { FaqSection } from '@/components/marketing/FaqSection';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { WorkflowIllustration, type WorkflowStep } from '@/components/marketing/WorkflowIllustration';
import { marketingRoutes } from '@/lib/marketing-content';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';
import { buildMarketingStructuredData } from '@/lib/structured-data';

export const metadata = buildMarketingMetadata('home');

const loop: WorkflowStep[] = [
  {
    label: 'Standard',
    title: 'Define what a strong pitch needs to cover',
    description: 'Organizers publish the event-specific criteria and the pitch duration founders should prepare for.',
  },
  {
    label: 'Plan',
    title: 'Turn the standard into a focused preparation plan',
    description: 'Founders see the areas to address and can prepare each part of the pitch deliberately.',
  },
  {
    label: 'Practice',
    title: 'Record event takes in a controlled cohort',
    description: 'Founders rehearse inside the event context instead of scattering video links across tools.',
  },
  {
    label: 'Feedback',
    title: 'Make the next revision actionable',
    description: 'Human reviewers connect observations and next steps to the same pitch criteria.',
  },
  {
    label: 'Best Take',
    title: 'Choose the take that represents the strongest current pitch',
    description: 'Founders select a Best Take for the event workflow when they are ready to submit.',
  },
];

const organizerOutcomes = [
  {
    icon: ListChecks,
    title: 'One preparation standard',
    body: 'Give every founder the same event-specific expectations, including a configurable pitch length from one to six minutes.',
  },
  {
    icon: UsersRound,
    title: 'A coordinated review process',
    body: 'Invite founders, team members, and reviewers; share announcements; and organize feedback before final submissions.',
  },
  {
    icon: ClipboardCheck,
    title: 'Progress you can inspect',
    body: 'See participation, preparation activity, feedback coverage, and final submissions without claiming that the platform caused an outcome.',
  },
];

export default function MarketingHomePage() {
  return (
    <div className="min-h-dvh bg-[#05070a] text-white">
      <JsonLd data={buildMarketingStructuredData('home')} />
      <MarketingHeader audience="organizer" currentPath="/" ctaSource="home-header" />
      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_5%,rgba(0,230,246,0.18),transparent_32rem),radial-gradient(circle_at_82%_14%,rgba(183,255,42,0.1),transparent_28rem)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
            <div>
              <p className="inline-flex rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-2 text-sm font-black text-neon-cyan">
                Guided pitch preparation for founder programs
              </p>
              <h1 className="mt-6 max-w-4xl text-balance font-heading text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
                Prepare every founder for the pitch standard that matters.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Give your cohort one clear standard, a guided plan, controlled event practice, and useful human feedback before event day.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LeadCaptureModal
                  type="organizer"
                  triggerLabel="Request organizer access"
                  source="home-hero"
                  triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-black"
                />
                <Link
                  href="/founders"
                  className="btn-glass inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-bold"
                >
                  See the founder experience
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <LockKeyhole className="h-4 w-4 text-neon-lime" aria-hidden="true" />
                Early access is invite-only. Event practice visibility is controlled.
              </p>
            </div>
            <WorkflowIllustration steps={loop} />
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">Before the live pitch</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Replace the scattered preparation stack.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                Rubrics in documents, video links in email, feedback in forms, and final files in shared drives make it hard to see whether founders are ready. Pitch in Public keeps the preparation sequence connected.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Set the standard', 'Publish the criteria and duration founders should prepare toward.', FileVideo],
                ['Guide the plan', 'Help founders translate expectations into concrete preparation work.', ListChecks],
                ['Coordinate people', 'Invite founders, teams, and reviewers into one event context.', UsersRound],
                ['Collect final work', 'Bring Best Takes, pitch decks, and final submissions together.', ClipboardCheck],
              ].map(([title, body, Icon]) => (
                <article key={String(title)} className="glass-card rounded-2xl p-6">
                  <Icon className="h-6 w-6 text-neon-cyan" aria-hidden="true" />
                  <h3 className="mt-5 font-heading text-xl font-black">{String(title)}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{String(body)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">For program teams</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Run preparation with context, control, and a clear finish line.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {organizerOutcomes.map(({ icon: Icon, title, body }) => (
                <article key={title} className="glass-card rounded-[1.5rem] p-6">
                  <Icon className="h-7 w-7 text-neon-lime" aria-hidden="true" />
                  <h3 className="mt-5 font-heading text-2xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-950/65 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2">
            <article className="rounded-[2rem] border border-neon-cyan/20 bg-neon-cyan/[0.07] p-7 sm:p-9">
              <MessageSquareText className="h-8 w-8 text-neon-cyan" aria-hidden="true" />
              <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">Founder outcome</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Know what to revise in the next take.</h2>
              <p className="mt-4 leading-8 text-slate-300">
                Founders prepare against the actual event standard, receive criterion-bound human observations and next steps, then choose a Best Take when they are ready to submit.
              </p>
              <Link href="/founders" className="mt-6 inline-flex items-center gap-2 font-bold text-neon-cyan hover:text-white">
                Explore the founder workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
            <article className="rounded-[2rem] border border-neon-lime/20 bg-neon-lime/[0.06] p-7 sm:p-9">
              <Eye className="h-8 w-8 text-neon-lime" aria-hidden="true" />
              <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-neon-lime">Controlled visibility</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Practice in the event. Share by choice.</h2>
              <p className="mt-4 leading-8 text-slate-300">
                Event takes are available according to event access and visibility settings. Founders decide whether an eligible take should be published more broadly.
              </p>
              <Link href="/for-events" className="mt-6 inline-flex items-center gap-2 font-bold text-neon-lime hover:text-white">
                See organizer controls <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

        <FaqSection items={marketingRoutes.home.faq} />

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="glass-panel mx-auto max-w-5xl rounded-[2rem] px-6 py-12 text-center sm:px-10">
            <h2 className="text-balance font-heading text-3xl font-black sm:text-5xl">
              Bring the preparation workflow into one place.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Tell us about the founder program, cohort, competition, or demo day you are preparing.
            </p>
            <div className="mt-8 flex justify-center">
              <LeadCaptureModal
                type="organizer"
                triggerLabel="Request organizer access"
                source="home-final-cta"
                triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-7 py-4 font-heading font-black"
              />
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
