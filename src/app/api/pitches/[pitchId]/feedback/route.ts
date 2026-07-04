import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { z } from 'zod';

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

    // Validate pitch exists
    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id')
      .eq('id', params.pitchId)
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

    // Insert feedback
    const { data: feedback, error: insertError } = await supabase
      .from('feedback')
      .insert({
        pitch_id: params.pitchId,
        user_id: user.id,
        type: feedbackData.type,
        content: serializeFeedbackContent(feedbackData),
        is_public: true, // Default to public in Phase 1
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating feedback:', insertError);
      throw insertError;
    }

    // Update streak (feedback counts toward streak)
    try {
      await supabase.rpc('update_user_streak', {
        user_id: user.id,
        activity_type: feedbackData.type,
      });
    } catch (error) {
      console.error('Error updating streak:', error);
      // Non-fatal, don't throw
    }

    try {
      await supabase
        .from('practice_reps')
        .update({
          readiness: feedbackData.readiness,
          clarity_delta: feedbackData.type === 'toast' ? 1 : 0,
        })
        .eq('pitch_id', params.pitchId);
    } catch (error) {
      console.error('Error updating practice rep signal:', error);
    }

    return NextResponse.json(
      {
        success: true,
        feedback: {
          id: feedback.id,
          type: feedback.type,
          signal: signals[0],
          signals,
          readiness: feedbackData.readiness,
          notes: feedbackData.notes?.trim() || '',
          scores: scoresFromFeedback(feedbackData),
          createdAt: feedback.created_at,
        },
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create feedback',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
