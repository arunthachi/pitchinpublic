export type PracticeFocus = 'clarity' | 'customer' | 'problem' | 'traction' | 'ask' | 'confidence';

export interface PracticePrompt {
  key: string;
  focus: PracticeFocus;
  title: string;
  prompt: string;
  why: string;
}

export interface PracticeProgress {
  practiceDays: number;
  pitchReps: number;
  currentStreak: number;
  bestStreak: number;
  clarityDelta: number;
  bestTakeId: string | null;
  deadlineDaysLeft: number | null;
}

export const READINESS_LABELS: Record<number, string> = {
  1: 'Needs work',
  2: 'Getting there',
  3: 'Nearly ready',
  4: 'Pitch-ready',
};

export const PRACTICE_PROMPTS: PracticePrompt[] = [
  {
    key: 'opening-clarity',
    focus: 'clarity',
    title: 'Open with who it is for',
    prompt: 'Say the exact customer in sentence one before explaining the product.',
    why: 'Most weak pitches make listeners guess the audience. Remove that work immediately.',
  },
  {
    key: 'pain-specificity',
    focus: 'problem',
    title: 'Make the pain concrete',
    prompt: 'Name the painful moment, current workaround, and cost of doing nothing.',
    why: 'A real pain makes feedback useful because builders can judge urgency.',
  },
  {
    key: 'customer-pull',
    focus: 'customer',
    title: 'Prove someone wants it',
    prompt: 'Add one customer signal: usage, waitlist, LOI, paid pilot, or repeated complaint.',
    why: 'Traction can be tiny, but it must be specific enough to believe.',
  },
  {
    key: 'why-now',
    focus: 'traction',
    title: 'Explain why now',
    prompt: 'Give one reason this should work now and would not have worked two years ago.',
    why: 'Timing turns an idea into an opportunity.',
  },
  {
    key: 'specific-ask',
    focus: 'ask',
    title: 'End with one ask',
    prompt: 'Close with the single thing you want from the listener: feedback, intro, pilot, or vote.',
    why: 'A pitch without an ask makes the audience do the founder’s job.',
  },
  {
    key: 'camera-confidence',
    focus: 'confidence',
    title: 'Hold the room',
    prompt: 'Record standing up, look at the camera, and cut filler before your first noun.',
    why: 'The same words land differently when the founder looks ready.',
  },
];

export function getPracticePrompt(key?: string | null, fallbackIndex = 0) {
  return (
    PRACTICE_PROMPTS.find((prompt) => prompt.key === key) ||
    PRACTICE_PROMPTS[Math.abs(fallbackIndex) % PRACTICE_PROMPTS.length]
  );
}

export function getPromptForDate(date = new Date()) {
  const daySeed = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000
  );
  return getPracticePrompt(null, daySeed);
}

export function daysUntil(dateValue?: string | null) {
  if (!dateValue) return null;

  const today = new Date();
  const target = new Date(`${dateValue}T12:00:00`);
  today.setHours(12, 0, 0, 0);

  if (Number.isNaN(target.getTime())) return null;
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}

export function readinessLabel(readiness?: number | null) {
  if (!readiness) return 'No signal yet';
  return READINESS_LABELS[readiness] || 'No signal yet';
}

export function nudgeCopy(prompt: PracticePrompt) {
  return `Today's pitch sprint: ${prompt.prompt} Record a 60-second take and see if it beats your best one.`;
}
