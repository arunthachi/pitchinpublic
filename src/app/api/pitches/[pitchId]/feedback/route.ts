import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { z } from 'zod';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';
import {
  reviewerRoleLabel,
} from '@/lib/review-marketplace-server';
import { isPublicPitchId, isUuidLike } from '@/lib/public-routes';
import { feedbackSubmissionRpc } from './_server';

/**
 * POST /api/pitches/[pitchId]/feedback
 * Submit detailed feedback on a pitch
 *
 * Rate Limited: 100 requests per hour per IP
 *
 * Request body:
 * {
 *   "type": "roast" | "toast",
 *   "signal": "string",
 *   "signals": ["string"],
 *   "readiness": number (1-4),
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "feedback": {
 *     "id": "uuid",
 *     "type": "roast" | "toast",
 *     "scores": {...},
 *     "createdAt": "timestamp"
 *   }
 * }
 */

const feedbackSchema = z.object({
  type: z.enum(['roast', 'toast']),
  signal: z.string().min(2).max(80).optional(),
  signals: z.array(z.string().min(2).max(80)).min(1).max(3).optional(),
  readiness: z.number().int().min(1).max(4),
  scores: z.object({
    clarity: z.number().min(1).max(10),
    solution: z.number().min(1).max(10),
    market: z.number().min(1).max(10),
    presentation: z.number().min(1).max(10),
  }).optional(),
  notes: z.string().max(2000).optional(),
  eventSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  structured: z.object({
    criterionKey: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
    sentiment: z.enum(['strength', 'improvement']),
    observation: z.string().trim().min(2).max(1200),
    nextStep: z.string().trim().min(2).max(1200),
  }).optional(),
}).superRefine((value, ctx) => {
  if (!value.signal && !value.signals?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['signals'],
      message: 'Select at least one feedback signal.',
    });
  }
});

function normalizedSignals(feedback: z.infer<typeof feedbackSchema>) {
  const rawSignals = feedback.signals?.length ? feedback.signals : [feedback.signal || 'Clear'];
  return [...new Set(rawSignals.map((item) => item.trim()).filter(Boolean))].slice(0, 3);
}

function serializeFeedbackContent(feedback: z.infer<typeof feedbackSchema>) {
  const score = feedback.readiness * 2.5;
  const scores = feedback.scores || {
    clarity: score,
    solution: score,
    market: score,
    presentation: score,
  };

  const signals = normalizedSignals(feedback);

  return JSON.stringify({
    notes: feedback.notes?.trim() || '',
    signal: signals[0],
    signals,
    readiness: feedback.readiness,
    scores,
  });
}

function scoresFromFeedback(feedback: z.infer<typeof feedbackSchema>) {
  const score = feedback.readiness * 2.5;
  return feedback.scores || {
    clarity: score,
    solution: score,
    market: score,
    presentation: score,
  };
}

export async function POST(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
  const params = await props.params;
  const ip = getClientIp(request);

  // Apply rate limiting
  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.API.limit,
    window: RATE_LIMITS.API.window,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: formatRateLimitHeaders(result),
      }
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  try {
    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        {
          status: 401,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    if (!(await isUserAllowedForPilot(user))) {
      return NextResponse.json(
        {
          success: false,
          error: INVITE_ONLY_MESSAGE,
          code: 'invite_required',
        },
        {
          status: 403,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Accept the stable public pitch identifier while retaining UUID compatibility
    // for existing clients during rollout.
    if (!isPublicPitchId(params.pitchId) && !isUuidLike(params.pitchId)) {
      return NextResponse.json(
        { success: false, error: 'Pitch not found' },
        { status: 404, headers: formatRateLimitHeaders(result) }
      );
    }
    const pitchLookupColumn = isPublicPitchId(params.pitchId) ? 'public_id' : 'id';
    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id,user_id,public_id')
      .eq(pitchLookupColumn, params.pitchId)
      .is('deleted_at', null)
      .single();

    if (pitchError || !pitch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pitch not found',
        },
        {
          status: 404,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    if (pitch.user_id === user.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot leave feedback on your own pitch.' },
        { status: 403, headers: formatRateLimitHeaders(result) }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = feedbackSchema.safeParse(body);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid feedback data',
          errors,
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const feedbackData = validation.data;
    const signals = normalizedSignals(feedbackData);

    let feedbackEventId: string | null = null;
    if (feedbackData.eventSlug) {
      const { data: resolvedEventId, error: eventAccessError } = await supabase.rpc(
        'resolve_event_feedback_scope',
        {
          target_event_slug: feedbackData.eventSlug,
          target_pitch_id: pitch.id,
        },
      );

      if (eventAccessError || !resolvedEventId) {
        return NextResponse.json(
          { success: false, error: 'This event review is no longer available.', code: 'event_review_access_required' },
          { status: 403, headers: formatRateLimitHeaders(result) }
        );
      }

      feedbackEventId = resolvedEventId;
    }

    const idempotencyHeader = request.headers.get('idempotency-key');
    const parsedIdempotencyKey = idempotencyHeader
      ? z.string().uuid().safeParse(idempotencyHeader)
      : null;
    if (parsedIdempotencyKey && !parsedIdempotencyKey.success) {
      return NextResponse.json(
        { success: false, error: 'Idempotency-Key must be a UUID.' },
        { status: 400, headers: formatRateLimitHeaders(result) }
      );
    }

    const submissionKey = parsedIdempotencyKey?.success
      ? parsedIdempotencyKey.data
      : crypto.randomUUID();
    const submission = feedbackSubmissionRpc(
      pitch.id,
      feedbackData.type,
      serializeFeedbackContent(feedbackData),
      submissionKey,
      feedbackEventId
    );
    const structured = feedbackData.structured;
    const { data: submissionRows, error: submissionError } = structured && feedbackEventId
      ? await supabase.rpc('submit_structured_event_pitch_feedback', {
          target_pitch_id: pitch.id,
          feedback_type: feedbackData.type,
          feedback_content: serializeFeedbackContent(feedbackData),
          target_event_id: feedbackEventId,
          submission_key: submissionKey,
          criterion: structured.criterionKey,
          observed: structured.observation,
          recommended_next_step: structured.nextStep,
        })
      : await supabase.rpc(submission.name, submission.args);

    const feedback = structured
      ? { feedback_id: submissionRows, submitted_type: feedbackData.type, reviewer_role: 'reviewer', created_at: new Date().toISOString(), assignment_completed: false, idempotent_replay: false }
      : (Array.isArray(submissionRows) ? submissionRows[0] : submissionRows);
    if (submissionError || !feedback) {
      console.error('Error creating feedback:', submissionError);
      throw submissionError || new Error('Feedback could not be saved');
    }

    const reviewerRole = feedback.reviewer_role;

    if (!feedback.idempotent_replay) {
      // These are secondary signals; the authoritative feedback transaction has
      // already committed and idempotent retries must not apply them twice.
      try {
        await supabase.rpc('update_user_streak', {
          user_id: user.id,
          activity_type: feedbackData.type,
        });
      } catch (error) {
        console.error('Error updating streak:', error);
      }

      try {
        await supabase
          .from('practice_reps')
          .update({
            readiness: feedbackData.readiness,
            clarity_delta: feedbackData.type === 'toast' ? 1 : 0,
          })
          .eq('pitch_id', pitch.id);
      } catch (error) {
        console.error('Error updating practice rep signal:', error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        feedback: {
          id: feedback.feedback_id,
          type: feedback.submitted_type,
          signal: signals[0],
          signals,
          readiness: feedbackData.readiness,
          notes: feedbackData.notes?.trim() || '',
          scores: scoresFromFeedback(feedbackData),
          reviewerRole,
          reviewerRoleLabel: reviewerRoleLabel(reviewerRole),
          createdAt: feedback.created_at,
          ...(structured ? {
            criterionKey: structured.criterionKey,
            sentiment: structured.sentiment,
            observation: structured.observation,
            nextStep: structured.nextStep,
          } : {}),
        },
        assignmentCompleted: Boolean(feedback.assignment_completed),
      },
      {
        headers: {
          ...formatRateLimitHeaders(result),
          'Idempotency-Key': submissionKey,
        },
      }
    );
  } catch (error) {
    console.error('Error creating feedback:', error);
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Failed to create feedback';
    const alreadyReviewed = /already reviewed this pitch/i.test(message);
    const accessDenied = /access denied|no longer available/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: alreadyReviewed
          ? 'You already reviewed this pitch.'
          : accessDenied
            ? 'This pitch is no longer available for review.'
            : message,
        code: alreadyReviewed ? 'already_reviewed' : accessDenied ? 'review_access_revoked' : 'feedback_failed',
      },
      {
        status: alreadyReviewed ? 409 : accessDenied ? 403 : 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
