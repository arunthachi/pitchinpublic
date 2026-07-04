'use client';

import type React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight, Gauge, Repeat2, Sparkles, Target, Trophy, Video, Zap } from 'lucide-react';
import { PracticePrompt } from '@/lib/practice';

interface PracticeLoopPanelProps {
  prompt: PracticePrompt;
  nudge: string;
  progress: {
    practiceDays: number;
    pitchReps: number;
    currentStreak: number;
    bestStreak: number;
    clarityDelta: number;
    bestTakeId: string | null;
    deadlineDaysLeft: number | null;
  };
  readinessLabel: string;
  goalName?: string | null;
  latestRepNumber?: number | null;
  onRecord: () => void;
  onOpenGoal: () => void;
}

export function PracticeLoopPanel({
  prompt,
  nudge,
  progress,
  readinessLabel,
  goalName,
  latestRepNumber,
  onRecord,
  onOpenGoal,
}: PracticeLoopPanelProps) {
  const hasBestTake = Boolean(progress.bestTakeId);
  const loopProgress = Math.min(100, progress.pitchReps * 12 + progress.practiceDays * 8 + (hasBestTake ? 18 : 0));

  return (
    <motion.aside
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden max-h-[calc(100dvh-2rem)] w-[330px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] xl:block [&::-webkit-scrollbar]:hidden"
    >
      <div className="glass-card rounded-[1.5rem] border-white/12 bg-white/[0.055] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan">
              <Zap className="h-3.5 w-3.5" />
              Today
            </div>
            <h2 className="font-heading text-xl font-black leading-tight text-white">
              {prompt.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenGoal}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-300 transition hover:border-neon-cyan/50 hover:text-white"
            aria-label="Open pitch goal"
          >
            <Target className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm leading-5 text-slate-200">{prompt.prompt}</p>
        <p className="mt-3 border-l-2 border-neon-lime/60 pl-3 text-xs leading-5 text-slate-400">
          {prompt.why}
        </p>

        <button
          type="button"
          onClick={onRecord}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime px-5 py-3.5 font-heading text-base font-black text-slate-950 shadow-[0_18px_46px_rgba(0,230,246,0.18)] transition hover:scale-[1.01]"
        >
          <Video className="h-5 w-5" />
          Record today&apos;s rep
        </button>

        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neon-lime">
            <Sparkles className="h-4 w-4" />
            Nudge
          </div>
          <p className="text-sm leading-5 text-slate-300">{nudge}</p>
        </div>
      </div>

      <div className="glass-card rounded-[1.5rem] border-white/12 bg-white/[0.045] p-3.5 backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-neon-cyan" />
            <p className="font-heading font-bold text-white">Pitch loop</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300">
            {readinessLabel}
          </span>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${loopProgress}%` }}
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-lime to-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric icon={<Repeat2 className="h-4 w-4" />} label="Reps" value={String(progress.pitchReps)} />
          <Metric icon={<CalendarDays className="h-4 w-4" />} label="Days" value={String(progress.practiceDays)} />
          <Metric icon={<Zap className="h-4 w-4" />} label="Run" value={`${progress.currentStreak}d`} />
          <Metric icon={<Trophy className="h-4 w-4" />} label="Best" value={hasBestTake ? 'Set' : 'None'} />
        </div>

        <button
          type="button"
          onClick={onOpenGoal}
          className="mt-3 flex w-full items-center justify-between rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-left transition hover:bg-white/[0.09]"
        >
          <span>
            <span className="block text-sm font-bold text-white">{goalName || 'Daily pitch practice'}</span>
            <span className="block text-xs text-slate-400">
              {progress.deadlineDaysLeft === null
                ? `Latest ${latestRepNumber ? `Rep ${latestRepNumber}` : 'rep pending'}`
                : `${progress.deadlineDaysLeft} days to pitch day`}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </button>
      </div>
    </motion.aside>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-neon-cyan">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      </div>
      <p className="font-heading text-lg font-black text-white">{value}</p>
    </div>
  );
}
