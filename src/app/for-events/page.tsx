import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  ChartNoAxesCombined,
  ClipboardList,
  FileCheck2,
  LockKeyhole,
  MessagesSquare,
  Settings2,
  UserRoundCheck,
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

export const metadata = buildMarketingMetadata('forEvents');

const eventWorkflow: WorkflowStep[] = [
  {
    label: 'Set up',
    title: 'Define the Pitch Standard',
    description: 'Set the event context, criteria, visibility, and a pitch duration from one to six minutes.',
  },
  {
    label: 'Prepare',
    title: 'Guide founder practice',
    description: 'Founders use the standard to create a Pitch Plan and record takes inside the event.',
  },
  {
    label: 'Review',
    title: 'Coordinate useful human feedback',
    description: 'Invite reviewers and peers to leave observations and next steps tied to the criteria.',
  },
  {
    label: 'Finish',
    title: 'Collect final submissions',
    description: 'Founders choose a Best Take and provide the pitch materials required by the program.',
  },
];

export default function ForEventsPage() {
  return (
    <div className="min-h-dvh bg-[#05070a] text-white">
      <JsonLd data={buildMarketingStructuredData('forEvents')} />
      <MarketingHeader audience="organizer" currentPath="/for-events" ctaSource="organizers-header" />
      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_4%,rgba(0,230,246,0.19),transparent_32rem),radial-gradient(circle_at_84%_12%,rgba(183,255,42,0.09),transparent_27rem)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-2 text-sm font-black text-neon-cyan">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Invite-only organizer access
              </p>
              <h1 className="mt-6 max-w-4xl text-balance font-heading text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
                Run pitch preparation with one standard and one workflow.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Coordinate founder practice, reviewers, final submissions, and progress visibility before the live event.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LeadCaptureModal
                  type="organizer"
                  triggerLabel="Request organizer access"
                  source="organizers-hero"
                  triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-black"
                />
                <Link href="/founders" className="btn-glass inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-bold">
                  See how founders prepare
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <WorkflowIllustration steps={eventWorkflow} caption="Illustrative event preparation workflow" />
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">A controlled preparation room</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Fewer disconnected files. More preparation context.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                Keep criteria, founder takes, reviewer input, announcements, decks, and final submissions attached to the same program instead of coordinating them across forms, email, shared drives, and spreadsheets.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Settings2, title: 'Adapt the standard', body: 'Define the criteria and configure the pitch duration for the event format.' },
                { icon: UserRoundCheck, title: 'Control membership', body: 'Invite founders, team members, and reviewers into the appropriate event context.' },
                { icon: BellRing, title: 'Keep the cohort aligned', body: 'Use announcements and a cohort feed to keep preparation guidance visible.' },
                { icon: MessagesSquare, title: 'Coordinate review', body: 'Organize structured feedback and optionally enable peer feedback for the cohort.' },
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
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">From brief to final materials</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                Give every stage of preparation a clear owner.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <article className="rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
                <ClipboardList className="h-7 w-7 text-neon-lime" aria-hidden="true" />
                <h3 className="mt-5 font-heading text-2xl font-black">Organizers set the brief</h3>
                <p className="mt-3 leading-7 text-slate-400">Publish the standard, duration, access settings, and preparation guidance for the event.</p>
              </article>
              <article className="rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
                <MessagesSquare className="h-7 w-7 text-neon-lime" aria-hidden="true" />
                <h3 className="mt-5 font-heading text-2xl font-black">Reviewers provide signal</h3>
                <p className="mt-3 leading-7 text-slate-400">Connect human observations and suggested next steps to the criteria founders are working toward.</p>
              </article>
              <article className="rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
                <FileCheck2 className="h-7 w-7 text-neon-lime" aria-hidden="true" />
                <h3 className="mt-5 font-heading text-2xl font-black">Founders submit their work</h3>
                <p className="mt-3 leading-7 text-slate-400">Choose a Best Take and provide the deck or final materials required by the event.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">Outcome reporting</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                See how the preparation workflow was used.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Review participation, preparation activity, feedback coverage, and final submissions. Export the report as CSV or use a print-friendly view for program follow-up.
              </p>
              <p className="mt-4 max-w-2xl leading-7 text-slate-500">
                Reports summarize activity and progress signals. They do not establish that Pitch in Public caused a fundraising, judging, or business result.
              </p>
            </div>
            <div className="glass-panel rounded-[2rem] p-6 sm:p-8" aria-label="Illustrative report contents">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Illustrative report contents</p>
              <ChartNoAxesCombined className="mt-7 h-9 w-9 text-neon-cyan" aria-hidden="true" />
              <ul className="mt-6 space-y-3">
                {['Founder participation', 'Practice and submission status', 'Feedback coverage', 'Best Take and deck readiness'].map((item) => (
                  <li key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-neon-lime" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <FaqSection items={marketingRoutes.forEvents.faq} title="Organizer workflow questions." />

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="glass-panel mx-auto max-w-5xl rounded-[2rem] px-6 py-12 text-center sm:px-10">
            <h2 className="text-balance font-heading text-3xl font-black sm:text-5xl">Prepare the room before founders enter it.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Tell us about your pitch event, accelerator cohort, demo day, or founder program.
            </p>
            <div className="mt-8 flex justify-center">
              <LeadCaptureModal
                type="organizer"
                triggerLabel="Request organizer access"
                source="organizers-final-cta"
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
