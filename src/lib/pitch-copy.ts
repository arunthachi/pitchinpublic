export interface PitchPilotDetails {
  startupName: string;
  oneLinePitch: string;
  feedbackAsk: string;
  context: string;
}

export interface PitchMetadataFields {
  startup_name?: string | null;
  one_line_pitch?: string | null;
  feedback_ask?: string | null;
  extra_context?: string | null;
  take_version?: number | null;
  version_number?: number | null;
  is_best_take?: boolean | null;
  description?: string | null;
  hook?: string | null;
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
  return parsePitchDescription(description).feedbackAsk;
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

export function getPitchStartupNameFromFields(pitch: PitchMetadataFields, fallback = 'Startup') {
  return pitch.startup_name || getPitchStartupName(pitch.description, fallback);
}

export function getPitchFeedbackAskFromFields(pitch: PitchMetadataFields) {
  return pitch.feedback_ask || getPitchFeedbackAsk(pitch.description);
}

export function getPitchContextFromFields(pitch: PitchMetadataFields) {
  return pitch.extra_context || getPitchContext(pitch.description);
}

export function getPitchOneLineFromFields(pitch: PitchMetadataFields) {
  return pitch.one_line_pitch || pitch.hook || '';
}

export function getTakeLabelFromFields(pitch: PitchMetadataFields) {
  return getTakeLabel(pitch.take_version || pitch.version_number, Boolean(pitch.is_best_take));
}
