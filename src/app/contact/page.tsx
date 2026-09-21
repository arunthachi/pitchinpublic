import { Mail, UserRound, UsersRound } from 'lucide-react';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { marketingRoutes } from '@/lib/marketing-content';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';
import { buildMarketingStructuredData } from '@/lib/structured-data';

export const metadata = buildMarketingMetadata('contact');

export default function ContactPage() {
  return (
    <div className="min-h-dvh bg-[#05070a] text-white">
      <JsonLd data={buildMarketingStructuredData('contact')} />
      <MarketingHeader currentPath="/contact" showLeadCta={false} />
      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(0,230,246,0.18),transparent_34rem),radial-gradient(circle_at_82%_12%,rgba(183,255,42,0.08),transparent_28rem)]" />
          <div className="relative mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">Contact</p>
            <h1 className="mt-4 max-w-4xl text-balance font-heading text-5xl font-black leading-[1.03] sm:text-6xl lg:text-7xl">
              Tell us how you prepare founders to pitch.
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              Request the access that matches your role, or email us with a question about a founder program, pitch event, or invitation.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
            <article className="glass-panel rounded-[2rem] p-7 sm:p-9">
              <UsersRound className="h-8 w-8 text-neon-cyan" aria-hidden="true" />
              <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">Organizers</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Preparing a program or event?</h2>
              <p className="mt-4 leading-8 text-slate-300">
                Share the event, cohort, accelerator, competition, or demo day you want to support. Organizer access is currently invite-only.
              </p>
              <div className="mt-7">
                <LeadCaptureModal
                  type="organizer"
                  triggerLabel="Request organizer access"
                  source="contact-organizer"
                  triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-black"
                />
              </div>
            </article>
            <article className="glass-panel rounded-[2rem] p-7 sm:p-9">
              <UserRound className="h-8 w-8 text-neon-lime" aria-hidden="true" />
              <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-neon-lime">Founders</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Looking for founder access?</h2>
              <p className="mt-4 leading-8 text-slate-300">
                If you already have an event invitation, use the invited email to sign in. Otherwise, request early founder access and we will follow up.
              </p>
              <div className="mt-7">
                <LeadCaptureModal
                  type="founder"
                  triggerLabel="Request founder access"
                  source="contact-founder"
                  triggerClassName="cta-primary inline-flex items-center justify-center gap-2 px-6 py-4 font-heading font-black"
                />
              </div>
            </article>
          </div>
        </section>

        <section className="border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Mail className="mx-auto h-8 w-8 text-neon-cyan" aria-hidden="true" />
            <h2 className="mt-5 font-heading text-3xl font-black">Prefer email?</h2>
            <p className="mt-4 leading-7 text-slate-300">
              Include whether you are a founder, organizer, coach, mentor, or reviewer, plus enough context for us to route your message.
            </p>
            <a href="mailto:hello@pitchinpublic.io" className="btn-glass mt-7 inline-flex items-center justify-center px-6 py-4 font-heading font-bold text-neon-cyan">
              hello@pitchinpublic.io
            </a>
            <p className="mt-4 text-sm text-slate-500">We will follow up by email. No response-time commitment is implied.</p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
