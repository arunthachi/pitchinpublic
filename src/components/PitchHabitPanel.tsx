'use client';

import type React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Gauge,
  Lock,
  MessageSquareText,
  Repeat2,
  Sparkles,
  Target,
  Trophy,
  Video,
  Zap,
} from 'lucide-react';
import { PracticePrompt } from '@/lib/practice';

interface HabitProgress {
  practiceDays: number;
  pitchReps: number;
  currentStreak: number;
  bestStreak: number;
  clarityDelta: number;
  bestTakeId: string | null;
  deadlineDaysLeft: number | null;
}

interface PitchHabitPanelProps {
  prompt: PracticePrompt;
  nudge: string;
  progress: HabitProgress;
  readinessLabel: string;
  goalName?: string | null;
  latestRepNumber?: number | null;
  latestRepCreatedAt?: string | null;
  onRecord: () => void;
  onOpenGoal: () => void;
}

const pathSteps = [
  { title: 'Customer', detail: 'Name who it is for', tone: 'cyan' },
  { title: 'Pain', detail: 'Make the problem obvious', tone: 'lime' },
  { title: 'Pull', detail: 'Show why they care', tone: 'amber' },
  { title: 'Why now', detail: 'Create urgency', tone: 'violet' },
  { title: 'Ask', detail: 'End with one action', tone: 'cyan' },
  { title: 'Confidence', detail: 'Sound clear on camera', tone: 'lime' },
  { title: 'Best take', detail: 'Pick the one to share', tone: 'gold' },
] as const;

function isSameLocalDay(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

export function PitchHabitPanel({
  prompt,
  nudge,
  progress,
  readinessLabel,
  goalName,
  latestRepNumber,
  latestRepCreatedAt,
  onRecord,
  onOpenGoal,
}: PitchHabitPanelProps) {
  const hasBestTake = Boolean(progress.bestTakeId);
  const recordedToday = isSameLocalDay(latestRepCreatedAt);
  const pathIndex = Math.min(progress.pitchReps, pathSteps.length - 1);
  const loopProgress = Math.min(100, progress.pitchReps * 11 + progress.practiceDays * 7 + (hasBestTake ? 20 : 0));

  const quests = [
    {
      icon: <Video className="h-5 w-5" />,
      title: "Record today's rep",
      detail: prompt.title,
      done: recordedToday,
      value: recordedToday ? 1 : 0,
      total: 1,
    },
    {
      icon: <MessageSquareText className="h-5 w-5" />,
      title: 'Get one useful signal',
      detail: readinessLabel === 'No signal yet' ? 'Ask for Toast or Roast feedback' : readinessLabel,
      done: readinessLabel !== 'No signal yet',
      value: readinessLabel !== 'No signal yet' ? 1 : 0,
      total: 1,
    },
    {
      icon: <Trophy className="h-5 w-5" />,
      title: 'Choose a best take',
      detail: hasBestTake ? 'Ready to share' : 'Mark your strongest version',
      done: hasBestTake,
      value: hasBestTake ? 1 : 0,
      total: 1,
    },
  ];

  const achievements = [
    { title: 'First Rep', detail: 'Record one pitch', icon: <Video className="h-5 w-5" />, value: Math.min(progress.pitchReps, 1), total: 1 },
    { title: 'Three Takes', detail: 'Practice three versions', icon: <Repeat2 className="h-5 w-5" />, value: Math.min(progress.pitchReps, 3), total: 3 },
    { title: 'Signal Builder', detail: 'Earn a feedback signal', icon: <MessageSquareText className="h-5 w-5" />, value: readinessLabel !== 'No signal yet' ? 1 : 0, total: 1 },
    { title: 'Momentum', detail: 'Reach a 7 day run', icon: <Flame className="h-5 w-5" />, value: Math.min(progress.currentStreak, 7), total: 7 },
  ];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden h-full max-h-[calc(100dvh-2rem)] w-[360px] overflow-y-auto pr-1 [scrollbar-width:none] xl:block [&::-webkit-scrollbar]:hidden"
    >
      <div className="space-y-3">
        <section className="glass-card overflow-hidden rounded-[1.7rem] border-white/12 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
          <div className="border-b border-white/10 p-4">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan">
                  <Zap className="h-3.5 w-3.5" />
                  Today&apos;s pitch rep
                </div>
                <h2 className="font-heading text-2xl font-black leading-tight text-white">{prompt.title}</h2>
              </div>
              <button
                type="button"
                onClick={onOpenGoal}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-300 transition hover:border-neon-cyan/50 hover:text-white"
                aria-label="Open pitch goal"
              >
                <Target className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm leading-5 text-slate-200">{prompt.prompt}</p>
            <p className="mt-3 border-l-2 border-neon-lime/70 pl-3 text-xs leading-5 text-slate-400">{prompt.why}</p>

            <button
              type="button"
              onClick={onRecord}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime px-5 py-3.5 font-heading text-base font-black text-slate-950 shadow-[0_18px_46px_rgba(0,230,246,0.18)] transition hover:scale-[1.01]"
            >
              <Video className="h-5 w-5" />
              {recordedToday ? 'Record another rep' : "Record today's rep"}
            </button>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-neon-cyan" />
                <p className="font-heading font-bold text-white">Pitch loop</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300">{readinessLabel}</span>
            </div>

            <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${loopProgress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-lime to-white"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Metric icon={<Repeat2 className="h-4 w-4" />} label="Reps" value={String(progress.pitchReps)} />
              <Metric icon={<CalendarDays className="h-4 w-4" />} label="Days" value={String(progress.practiceDays)} />
              <Metric icon={<Flame className="h-4 w-4" />} label="Run" value={`${progress.currentStreak}d`} />
              <Metric icon={<Trophy className="h-4 w-4" />} label="Best" value={hasBestTake ? 'Set' : 'None'} />
            </div>

            <button
              type="button"
              onClick={onOpenGoal}
              className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.09]"
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
        </section>

        <section className="glass-card rounded-[1.7rem] border-white/12 bg-white/[0.045] p-4 backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan">Path</p>
              <h3 className="font-heading text-lg font-black text-white">Pitch Path</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-slate-300">
              Level {Math.max(1, Math.min(pathIndex + 1, pathSteps.length))}
            </span>
          </div>

          <div className="space-y-2">
            {pathSteps.map((step, index) => {
              const done = index < pathIndex || (index === pathSteps.length - 1 && hasBestTake);
              const current = !done && index === pathIndex;
              return (
                <div
                  key={step.title}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                    current
                      ? 'border-neon-cyan/45 bg-neon-cyan/10'
                      : done
                        ? 'border-neon-lime/25 bg-neon-lime/10'
                        : 'border-white/[0.06] bg-white/[0.035]'
                  }`}
                >
                  <PathNode done={done} current={current} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{step.title}</p>
                    <p className="truncate text-xs text-slate-400">{step.detail}</p>
                  </div>
                  {current ? <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neon-cyan">Now</span> : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass-card rounded-[1.7rem] border-white/12 bg-white/[0.045] p-4 backdrop-blur-2xl">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-neon-lime" />
            <h3 className="font-heading text-lg font-black text-white">Daily Quests</h3>
          </div>
          <div className="space-y-3">
            {quests.map((quest) => (
              <QuestRow key={quest.title} {...quest} />
            ))}
          </div>
        </section>

        <section className="glass-card rounded-[1.7rem] border-white/12 bg-white/[0.045] p-4 backdrop-blur-2xl">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-lime" />
            <h3 className="font-heading text-lg font-black text-white">Achievements</h3>
          </div>
          <div className="space-y-3">
            {achievements.map((achievement) => (
              <AchievementRow key={achievement.title} {...achievement} />
            ))}
          </div>
        </section>

        <section className="glass-card rounded-[1.5rem] border-neon-lime/20 bg-neon-lime/[0.055] p-4 backdrop-blur-2xl">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neon-lime">
            <Sparkles className="h-4 w-4" />
            Nudge
          </div>
          <p className="text-sm leading-5 text-slate-300">{nudge}</p>
        </section>
      </div>
    </motion.aside>
  );
}

export function MobileHabitNudge({
  prompt,
  progress,
  latestRepCreatedAt,
  onRecord,
  onOpenGoal,
}: Pick<PitchHabitPanelProps, 'prompt' | 'progress' | 'latestRepCreatedAt' | 'onRecord' | 'onOpenGoal'>) {
  const recordedToday = isSameLocalDay(latestRepCreatedAt);

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 lg:hidden">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto rounded-[1.4rem] border border-white/12 bg-slate-950/55 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenGoal}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/25 bg-neon-cyan/15 text-neon-cyan"
            aria-label="Open pitch goal"
          >
            <Target className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-neon-lime">
              {recordedToday ? 'Rep complete' : "Today's rep"}
            </p>
            <p className="truncate text-sm font-black text-white">{prompt.title}</p>
            <p className="truncate text-xs text-slate-400">
              {progress.pitchReps} reps - {progress.currentStreak}d run
            </p>
          </div>
          <button
            type="button"
            onClick={onRecord}
            className="flex h-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime px-4 font-heading text-sm font-black text-slate-950"
          >
            Record
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5">
      <div className="mb-1 flex items-center gap-1 text-neon-cyan">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      </div>
      <p className="font-heading text-base font-black text-white">{value}</p>
    </div>
  );
}

function PathNode({ done, current }: { done: boolean; current: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
        done
          ? 'border-neon-lime/50 bg-neon-lime text-slate-950'
          : current
            ? 'border-neon-cyan/55 bg-neon-cyan/15 text-neon-cyan shadow-[0_0_24px_rgba(0,229,255,0.18)]'
            : 'border-white/10 bg-white/[0.05] text-slate-500'
      }`}
    >
      {done ? <Check className="h-5 w-5 stroke-[3]" /> : current ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
    </span>
  );
}

function QuestRow({
  icon,
  title,
  detail,
  done,
  value,
  total,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  done: boolean;
  value: number;
  total: number;
}) {
  const width = Math.min(100, (value / total) * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${done ? 'bg-neon-lime text-slate-950' : 'bg-neon-cyan/12 text-neon-cyan'}`}>
          {done ? <Check className="h-5 w-5 stroke-[3]" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-black text-white">{title}</p>
            <span className="text-xs font-bold text-slate-400">{value}/{total}</span>
          </div>
          <p className="truncate text-xs text-slate-400">{detail}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${done ? 'bg-neon-lime' : 'bg-gradient-to-r from-neon-cyan to-neon-lime'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function AchievementRow({
  icon,
  title,
  detail,
  value,
  total,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  value: number;
  total: number;
}) {
  const done = value >= total;
  const width = Math.min(100, (value / total) * 100);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${done ? 'bg-neon-lime text-slate-950' : 'bg-white/[0.07] text-slate-400'}`}>
        {done ? <Trophy className="h-5 w-5" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-white">{title}</p>
          <span className="text-xs font-bold text-slate-400">{value}/{total}</span>
        </div>
        <div className="my-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime" style={{ width: `${width}%` }} />
        </div>
        <p className="truncate text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  );
}
