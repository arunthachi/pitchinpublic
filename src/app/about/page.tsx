import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/?alpha=1&preview=1" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <div className="glass-panel mt-8 rounded-[2rem] p-6 sm:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
            <Sparkles className="h-4 w-4" />
            About
          </div>
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">A pitch gym for founders.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Pitch in Public helps founders practice short pitch reps, get useful Toast/Roast feedback, and leave with a stronger best take for demos, competitions, cohorts, and investor conversations.
          </p>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            The goal is simple: record, get signal, improve, repeat.
          </p>
        </div>
      </section>
    </main>
  );
}
