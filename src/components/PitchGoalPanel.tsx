'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Flag,
  Repeat2,
  Sparkles,
  Target,
  Trophy,
  Video,
  X,
} from 'lucide-react';
import type { LegacyPitch } from '@/types';

interface PitchGoalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordPitch: () => void;
  userPitches: LegacyPitch[];
}

interface PitchGoal {
  name: string;
  pitchDate: string;
  pitchType: string;
  focus: string;
  bestPitchId?: string;
  createdAt: string;
}

const STORAGE_KEY = 'pip.pitchGoal.v1';

const pitchTypes = [
  { value: 'competition', label: 'Pitch competition' },
  { value: 'demo_day', label: 'Demo day' },
  { value: 'investor', label: 'Investor meeting' },
  { value: 'networking', label: 'Speed networking' },
  { value: 'application', label: 'Application video' },
];

const focusOptions = [
  { value: 'clarity', label: 'Clarity' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'customer', label: 'Customer pull' },
  { value: 'fundraising', label: 'Fundraising story' },
  { value: 'winning', label: 'Winning the room' },
];

const focusPrompts: Record<string, string> = {
  clarity: 'Say who it is for in sentence one, then cut every vague phrase.',
  confidence: 'Record one take standing up and keep eye contact with the camera.',
  customer: 'Name the customer pain before naming the product.',
  fundraising: 'Connect the problem, market timing, and why you can win.',
  winning: 'End with one memorable line and one specific ask.',
};

function daysUntil(dateValue: string) {
  if (!dateValue) return 0;
  const today = new Date();
  const target = new Date(`${dateValue}T12:00:00`);
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}

function getPhase(daysLeft: number) {
  if (daysLeft > 60) return 'Foundation';
  if (daysLeft > 30) return 'Sharpen';
  if (daysLeft > 7) return 'Pressure test';
  if (daysLeft > 0) return 'Final reps';
  return 'Pitch day';
}

function makePlan(daysLeft: number, focus: string) {
  const phase = getPhase(daysLeft);
  const focusPrompt = focusPrompts[focus] || focusPrompts.clarity;

  if (phase === 'Foundation') {
    return [
      'Lock the audience, pain, and current workaround.',
      'Record three rough takes this week. Do not polish too early.',
      focusPrompt,
    ];
  }

  if (phase === 'Sharpen') {
    return [
      'Compare your last two takes and remove one confusing section.',
      'Ask for one Toast and one Roast from another builder.',
      focusPrompt,
    ];
  }

  if (phase === 'Pressure test') {
    return [
      'Record with the same time limit and posture you will use live.',
      'Practice the first 10 seconds until it lands without warmup.',
      focusPrompt,
    ];
  }

  if (phase === 'Final reps') {
    return [
      'Record one clean version, then stop editing unless feedback repeats.',
      'Pick the best take and write the one ask you want remembered.',
      focusPrompt,
    ];
  }

  return [
    'Warm up with one calm take before the real pitch.',
    'Open with customer, pain, solution, traction, ask.',
    'Submit or share the best take after the event.',
  ];
}

function defaultPitchDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function PitchGoalPanel({ isOpen, onClose, onRecordPitch, userPitches }: PitchGoalPanelProps) {
  const [goal, setGoal] = useState<PitchGoal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PitchGoal>({
    name: 'My next pitch day',
    pitchDate: defaultPitchDate(),
    pitchType: 'competition',
    focus: 'clarity',
    createdAt: new Date().toISOString(),
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as PitchGoal;
      setGoal(parsed);
      setForm(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [isOpen]);

  const daysLeft = goal ? daysUntil(goal.pitchDate) : daysUntil(form.pitchDate);
  const phase = getPhase(daysLeft);
  const plan = useMemo(
    () => makePlan(daysLeft, goal?.focus || form.focus),
    [daysLeft, form.focus, goal?.focus]
  );
  const bestPitch = userPitches.find((pitch) => pitch.id === goal?.bestPitchId);
  const latestPitch = userPitches[0];

  const saveGoal = () => {
    const nextGoal = {
      ...form,
      name: form.name.trim() || 'My next pitch day',
      createdAt: goal?.createdAt || new Date().toISOString(),
    };
    setGoal(nextGoal);
    setForm(nextGoal);
    setIsEditing(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGoal));
    }
  };

  const updateBestPitch = (pitchId: string) => {
    if (!goal) return;
    const nextGoal = { ...goal, bestPitchId: pitchId };
    setGoal(nextGoal);
    setForm(nextGoal);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGoal));
    }
  };

  const resetGoal = () => {
    const nextForm = {
      name: 'My next pitch day',
      pitchDate: defaultPitchDate(),
      pitchType: 'competition',
      focus: 'clarity',
      createdAt: new Date().toISOString(),
    };
    setGoal(null);
    setForm(nextForm);
    setIsEditing(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-3 top-3 z-[80] mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/92 shadow-2xl shadow-neon-cyan/10 backdrop-blur-2xl sm:inset-x-6 sm:top-6 sm:max-h-[calc(100dvh-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pitch-goal-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan">
                  <Flag className="h-4 w-4" />
                  Pitch Goal
                </div>
                <h2 id="pitch-goal-title" className="font-heading text-2xl font-bold text-white sm:text-4xl">
                  {goal && !isEditing ? goal.name : 'Build your pitch plan'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  Add your next event or deadline. PiP turns it into a practice plan with
                  daily reps, momentum, and a best-take submission habit.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-300 transition hover:bg-white/15 hover:text-white"
                aria-label="Close pitch goal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              {!goal || isEditing ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5">
                    <label className="block">
                      <span className="text-sm font-bold text-slate-200">Goal or event name</span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                        placeholder="Local Shark Tank pitch night"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-bold text-slate-200">Pitch date</span>
                      <input
                        type="date"
                        value={form.pitchDate}
                        onChange={(event) => setForm((current) => ({ ...current, pitchDate: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-bold text-slate-200">Pitch context</span>
                      <select
                        value={form.pitchType}
                        onChange={(event) => setForm((current) => ({ ...current, pitchType: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                      >
                        {pitchTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-bold text-slate-200">Primary focus</span>
                      <select
                        value={form.focus}
                        onChange={(event) => setForm((current) => ({ ...current, focus: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                      >
                        {focusOptions.map((focus) => (
                          <option key={focus.value} value={focus.value}>
                            {focus.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={saveGoal}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-5 py-3 font-heading font-bold text-slate-950 transition hover:scale-[1.01]"
                      >
                        Create pitch plan
                        <ArrowRight className="h-5 w-5" />
                      </button>
                      {goal && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="rounded-xl border border-white/10 px-5 py-3 font-heading font-bold text-slate-200 transition hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  <GoalPreview daysLeft={daysLeft} phase={phase} plan={plan} />
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-neon-cyan/20 bg-[linear-gradient(145deg,rgba(0,240,255,0.12),rgba(163,255,18,0.08)),rgba(255,255,255,0.04)] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neon-cyan">Countdown</p>
                          <p className="mt-2 font-heading text-5xl font-black text-white">{daysLeft}</p>
                          <p className="mt-1 text-sm text-slate-300">
                            {daysLeft === 1 ? 'day left' : 'days left'} - {phase}
                          </p>
                        </div>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                          <CalendarDays className="h-6 w-6 text-neon-lime" />
                        </span>
                      </div>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-neon-lime" />
                          <p className="font-heading font-bold text-white">Today&apos;s rep</p>
                        </div>
                        <p className="leading-7 text-slate-200">
                          {focusPrompts[goal.focus] || focusPrompts.clarity}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRecordPitch();
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-4 font-heading font-bold text-slate-950 transition hover:scale-[1.01]"
                      >
                        <Video className="h-5 w-5" />
                        Record rep
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 font-heading font-bold text-white transition hover:bg-white/10"
                      >
                        <Edit3 className="h-5 w-5" />
                        Edit goal
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neon-lime">
                            Practice plan
                          </p>
                          <h3 className="mt-1 font-heading text-2xl font-bold text-white">{phase}</h3>
                        </div>
                        <Repeat2 className="h-6 w-6 text-neon-cyan" />
                      </div>
                      <div className="space-y-3">
                        {plan.map((item) => (
                          <div key={item} className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" />
                            <p className="leading-6 text-slate-200">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neon-cyan">
                            Best take
                          </p>
                          <h3 className="mt-1 font-heading text-2xl font-bold text-white">
                            {bestPitch ? bestPitch.companyName : 'Pick after recording'}
                          </h3>
                        </div>
                        <Trophy className="h-6 w-6 text-neon-lime" />
                      </div>

                      {userPitches.length > 0 ? (
                        <div className="space-y-3">
                          <select
                            value={goal.bestPitchId || ''}
                            onChange={(event) => updateBestPitch(event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                          >
                            <option value="">Select a pitch</option>
                            {userPitches.map((pitch) => (
                              <option key={pitch.id} value={pitch.id}>
                                {pitch.companyName} - {new Date(pitch.createdAt).toLocaleDateString()}
                              </option>
                            ))}
                          </select>

                          {latestPitch && !goal.bestPitchId && (
                            <button
                              type="button"
                              onClick={() => updateBestPitch(latestPitch.id)}
                              className="w-full rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-3 text-sm font-bold text-neon-cyan transition hover:border-neon-cyan"
                            >
                              Mark latest pitch as best take
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-sm leading-6 text-slate-300">
                            Record your first rep, then come back and choose the take you
                            want to share with judges or the event organizer.
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded((current) => !current)}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left font-heading font-bold text-white"
                    >
                      Event submission workflow
                      <ChevronDown className={`h-5 w-5 transition ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-sm leading-7 text-slate-300">
                        The MVP stores your selected best take locally. The next backend step
                        is event rooms: organizer invites, founder submissions, judge review,
                        audience voting, and exportable results.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={resetGoal}
                      className="text-sm font-semibold text-slate-500 transition hover:text-slate-300"
                    >
                      Reset goal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function GoalPreview({ daysLeft, phase, plan }: { daysLeft: number; phase: string; plan: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neon-cyan">Preview</p>
          <h3 className="mt-2 font-heading text-3xl font-bold text-white">{phase}</h3>
        </div>
        <div className="rounded-2xl border border-neon-lime/25 bg-neon-lime/10 px-4 py-3 text-center">
          <p className="font-heading text-3xl font-black text-neon-lime">{daysLeft}</p>
          <p className="text-xs text-slate-300">days</p>
        </div>
      </div>
      <div className="space-y-3">
        {plan.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-neon-cyan" />
            <p className="leading-6 text-slate-200">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
