export const EVENT_FOCUS_OPTIONS = [
  'Clarity and ask',
  'ICP and audience',
  'Problem pain',
  'Storytelling',
  'Traction proof',
  'Investor Q&A',
  'Demo flow',
  'Competition prep',
] as const;

export const EVENT_VISIBILITY_OPTIONS = {
  private: {
    label: 'Private room',
    helper: 'Hidden from non-members. Founders need an invitation or event access code to join.',
  },
  unlisted: {
    label: 'Invite-only page',
    helper: 'Anyone with the page can view it, but founders still need an invitation or event access code to join.',
  },
  public: {
    label: 'Open room',
    helper: 'Anyone with the page can view it, and any signed-in founder can join without an invitation.',
  },
} as const;

export const EVENT_PITCH_LENGTH_OPTIONS = [
  { seconds: 60, label: '1 minute' },
  { seconds: 90, label: '1.5 minutes' },
  { seconds: 120, label: '2 minutes' },
  { seconds: 180, label: '3 minutes' },
  { seconds: 300, label: '5 minutes' },
  { seconds: 360, label: '6 minutes' },
] as const;

export type EventVisibility = keyof typeof EVENT_VISIBILITY_OPTIONS;

export function splitEventFocuses(value?: string | null) {
  return (value || '')
    .split(/[·,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
