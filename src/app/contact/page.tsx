import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <div className="glass-panel mt-8 rounded-[2rem] p-6 sm:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
            <Mail className="h-4 w-4" />
            Contact
          </div>
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Questions or event rooms?</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Email us and include whether you are a founder, organizer, coach, mentor, or judge.
          </p>
          <a href="mailto:hello@pitchinpublic.io" className="cta-primary mt-7 inline-flex rounded-full px-6 py-4 font-heading font-black">
            hello@pitchinpublic.io
          </a>
        </div>
      </section>
    </main>
  );
}
