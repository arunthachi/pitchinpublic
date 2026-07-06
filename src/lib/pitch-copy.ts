export interface PitchPilotDetails {
  startupName: string;
  oneLinePitch: string;
  feedbackAsk: string;
  context: string;
}

const labels = {
  startupName: 'Startup',
  feedbackAsk: 'Feedback ask',
  context: 'Context',
};

function readLabeledLine(description: string, label: string) {
  const match = description.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() || '';
}

export function buildPitchDescription(details: PitchPilotDetails) {
  return [
    `${labels.startupName}: ${details.startupName.trim()}`,
    `${labels.feedbackAsk}: ${details.feedbackAsk.trim()}`,
    details.context.trim() ? `${labels.context}: ${details.context.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function parsePitchDescription(description?: string | null) {
  const raw = description || '';
  const startupName = readLabeledLine(raw, labels.startupName);
  const feedbackAsk = readLabeledLine(raw, labels.feedbackAsk);
  const context = readLabeledLine(raw, labels.context);

  if (startupName || feedbackAsk || context) {
    return {
      startupName,
      feedbackAsk,
      context,
      isStructured: true,
    };
  }

  return {
    startupName: '',
    feedbackAsk: '',
    context: raw.trim(),
    isStructured: false,
  };
}

export function getPitchStartupName(description?: string | null, fallback = 'Startup') {
  return parsePitchDescription(description).startupName || fallback;
}

export function getPitchFeedbackAsk(description?: string | null) {
  return parsePitchDescription(description).feedbackAsk || 'Help sharpen ICP, clarity, and closing ask.';
}

export function getPitchContext(description?: string | null) {
  return parsePitchDescription(description).context;
}

export function getTakeLabel(versionNumber?: number | null, isBestTake?: boolean) {
  if (isBestTake) return 'Best Take';
  if (!versionNumber || versionNumber <= 1) return 'First Take';
  if (versionNumber === 2) return 'Better Take';
  return `Take ${versionNumber}`;
}
