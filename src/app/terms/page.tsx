import { ShieldCheck } from 'lucide-react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { marketingRoutes } from '@/lib/marketing-content';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';
import { buildMarketingStructuredData } from '@/lib/structured-data';

export const metadata = buildMarketingMetadata('terms');

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#05070a] text-white">
      <JsonLd data={buildMarketingStructuredData('terms')} />
      <MarketingHeader currentPath="/terms" showLeadCta={false} />
      <main id="main-content" tabIndex={-1} className="px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <article className="glass-panel mx-auto max-w-3xl rounded-[2rem] p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-2 text-sm font-black text-neon-cyan">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Terms &amp; Policies
          </div>
          <h1 className="mt-6 font-heading text-4xl font-black leading-tight sm:text-5xl">Use Pitch in Public constructively.</h1>
          <div className="mt-7 space-y-5 text-lg leading-8 text-slate-300">
            <p>Pitch in Public is an early-access product for founder pitch practice and constructive feedback.</p>
            <p>Do not upload confidential information, abusive content, or anything you do not have rights to share.</p>
            <p>Toast/Roast feedback should be direct, useful, and respectful.</p>
            <p>
              For privacy or policy questions, email{' '}
              <a className="font-bold text-neon-cyan hover:text-white" href="mailto:hello@pitchinpublic.io">
                hello@pitchinpublic.io
              </a>.
            </p>
          </div>
          <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-slate-500">
            This page preserves the existing early-access use guidance. It is not a statement about pricing, service levels, or product outcomes.
          </p>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
