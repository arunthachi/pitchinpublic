export type HistoryCursor = { beforeCreatedAt: string; beforeId: string };

export type GivenFeedbackItem = {
  feedbackId: string;
  pitch: {
    available: boolean;
    id: string | null;
    publicId: string | null;
    hook: string | null;
    startupName: string | null;
  };
  type: 'roast' | 'toast';
  content: Record<string, unknown>;
  reviewerRole: string | null;
  structured: {
    criterionKey: string | null;
    observation: string | null;
    nextStep: string | null;
  };
  createdAt: string;
};

export function feedbackHistoryRequestUrl(cursor: HistoryCursor | null) {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) {
    query.set('beforeCreatedAt', cursor.beforeCreatedAt);
    query.set('beforeId', cursor.beforeId);
  }
  return `/api/feedback/history?${query}`;
}

export function givenFeedbackNotes(item: GivenFeedbackItem) {
  if (typeof item.content.notes === 'string' && item.content.notes.trim()) return item.content.notes;
  if (item.structured.observation?.trim()) return item.structured.observation;
  return 'Signal-only feedback.';
}
