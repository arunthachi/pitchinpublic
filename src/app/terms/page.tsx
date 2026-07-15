import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/?alpha=1&preview=1" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <div className="glass-panel mt-8 rounded-[2rem] p-6 sm:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
            <ShieldCheck className="h-4 w-4" />
            Terms & Policies
          </div>
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Use Pitch in Public constructively.</h1>
          <div className="mt-5 space-y-4 text-lg leading-8 text-slate-300">
            <p>Pitch in Public is an early-access product for founder pitch practice and constructive feedback.</p>
            <p>Do not upload confidential information, abusive content, or anything you do not have rights to share.</p>
            <p>Toast/Roast feedback should be direct, useful, and respectful.</p>
            <p>For privacy or policy questions, email <a className="font-bold text-neon-cyan" href="mailto:hello@pitchinpublic.io">hello@pitchinpublic.io</a>.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
