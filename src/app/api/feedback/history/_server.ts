import { z } from 'zod';

export const FEEDBACK_HISTORY_RPC = 'get_my_feedback_history';
export const DEFAULT_HISTORY_PAGE_SIZE = 20;

const historyQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(DEFAULT_HISTORY_PAGE_SIZE),
    beforeCreatedAt: z.string().datetime({ offset: true }).optional(),
    beforeId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.beforeCreatedAt) === Boolean(value.beforeId)) return;

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'beforeCreatedAt and beforeId must be provided together.',
    });
  });

export type FeedbackHistoryQuery = z.infer<typeof historyQuerySchema>;

export type FeedbackHistoryRow = {
  feedback_id: string;
  pitch_id: string | null;
  pitch_available: boolean;
  pitch_public_id: string | null;
  pitch_hook: string | null;
  startup_name: string | null;
  feedback_type: string;
  feedback_content: string | null;
  reviewer_role: string | null;
  criterion_key: string | null;
  observation: string | null;
  next_step: string | null;
  created_at: string;
};

export function parseFeedbackHistoryQuery(searchParams: URLSearchParams) {
  return historyQuerySchema.safeParse({
    limit: searchParams.get('limit') || undefined,
    beforeCreatedAt: searchParams.get('beforeCreatedAt') || undefined,
    beforeId: searchParams.get('beforeId') || undefined,
  });
}

function parseContent(value: string | null) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return { notes: value };
  }
}

export function serializeFeedbackHistory(rows: FeedbackHistoryRow[], pageSize: number) {
  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);
  const finalRow = page.at(-1);

  return {
    items: page.map((row) => ({
      feedbackId: row.feedback_id,
      pitch: row.pitch_available
        ? {
            available: true as const,
            id: row.pitch_id,
            publicId: row.pitch_public_id,
            hook: row.pitch_hook,
            startupName: row.startup_name,
          }
        : {
            available: false as const,
            id: null,
            publicId: null,
            hook: null,
            startupName: null,
          },
      type: row.feedback_type === 'roast' ? 'roast' as const : 'toast' as const,
      content: parseContent(row.feedback_content),
      reviewerRole: row.reviewer_role,
      structured: {
        criterionKey: row.criterion_key,
        observation: row.observation,
        nextStep: row.next_step,
      },
      createdAt: row.created_at,
    })),
    nextCursor: hasMore && finalRow
      ? { beforeCreatedAt: finalRow.created_at, beforeId: finalRow.feedback_id }
      : null,
  };
}
