import Link from 'next/link';
import { ArrowRight, Eye, ListChecks, MessageSquareText, ShieldCheck } from 'lucide-react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { marketingRoutes } from '@/lib/marketing-content';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';
import { buildMarketingStructuredData } from '@/lib/structured-data';

export const metadata = buildMarketingMetadata('about');

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-[#05070a] text-white">
      <JsonLd data={buildMarketingStructuredData('about')} />
      <MarketingHeader currentPath="/about" showLeadCta={false} />
      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_0%,rgba(0,230,246,0.17),transparent_34rem),radial-gradient(circle_at_78%_10%,rgba(183,255,42,0.08),transparent_28rem)]" />
          <div className="relative mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">About Pitch in Public</p>
            <h1 className="mt-4 max-w-4xl text-balance font-heading text-5xl font-black leading-[1.03] sm:text-6xl lg:text-7xl">
              Pitch preparation should start before founders reach the stage.
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              We are building a guided preparation workspace that connects the standard an event sets with the plan a founder follows, the takes they practice, and the human feedback they use to revise.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">Why it exists</p>
              <h2 className="mt-3 text-balance font-heading text-3xl font-black sm:text-5xl">
                The final pitch is visible. The preparation work usually is not.
              </h2>
            </div>
            <div className="space-y-5 text-lg leading-8 text-slate-300">
              <p>
                Founder programs often define a strong pitch in one place, collect videos in another, coordinate reviewers through email, and track progress in spreadsheets. Founders are left to connect the pieces while preparing for a high-pressure moment.
              </p>
              <p>
                Pitch in Public brings those pieces into one event context. Organizers can set the Pitch Standard and coordinate the workflow. Founders can build a Pitch Plan, practice, receive useful human feedback, and choose a Best Take for submission.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-950/60 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">Product principles</p>
            <h2 className="mt-3 max-w-3xl text-balance font-heading text-3xl font-black sm:text-5xl">Clarity, useful feedback, and controlled access.</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ListChecks, title: 'Make the standard explicit', body: 'Founders should know the actual event criteria and duration before they record.' },
                { icon: MessageSquareText, title: 'Keep feedback human', body: 'Reviewers provide observations and next steps; automated coaching is not part of the product.' },
                { icon: ShieldCheck, title: 'Control event access', body: 'Membership and visibility are managed within the event context.' },
                { icon: Eye, title: 'Let founders choose public sharing', body: 'Broader publishing is a separate founder-controlled action, not the default for event practice.' },
              ].map(({ icon: Icon, title, body }) => (
                <article key={title} className="glass-card rounded-[1.5rem] p-6">
                  <Icon className="h-7 w-7 text-neon-lime" aria-hidden="true" />
                  <h3 className="mt-5 font-heading text-xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="glass-panel mx-auto grid max-w-6xl gap-6 rounded-[2rem] p-7 sm:p-10 md:grid-cols-2">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">For organizers</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Coordinate preparation before the event.</h2>
              <p className="mt-4 leading-7 text-slate-300">Set the standard, invite the cohort and reviewers, and bring feedback, submissions, decks, and reporting into one workflow.</p>
              <Link href="/for-events" className="mt-6 inline-flex items-center gap-2 font-bold text-neon-cyan hover:text-white">
                Explore organizer access <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="border-t border-white/10 pt-7 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">For founders</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Practice against the brief that matters.</h2>
              <p className="mt-4 leading-7 text-slate-300">Understand the standard, plan the pitch, use human feedback to revise, and choose the Best Take you want to submit.</p>
              <Link href="/founders" className="mt-6 inline-flex items-center gap-2 font-bold text-neon-lime hover:text-white">
                Explore the founder workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
