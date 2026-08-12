import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { pitchSchema } from '@/lib/validation';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { signedUrlsForRows } from '@/lib/video-providers/stream-tokens';
import { createSupabaseTokenStore } from '@/lib/video-providers/supabase-token-store';
import { getPromptForDate } from '@/lib/practice';
import { parsePitchDescription } from '@/lib/pitch-copy';
import { createPublicPitchId } from '@/lib/public-routes';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';
import { createServiceSupabase } from '@/lib/admin';
import { z } from 'zod';

const idempotencyKeySchema = z.string().uuid();

export function parsePitchIdempotencyKey(value: string | null) {
  if (!value) return { key: null, valid: true } as const;
  const parsed = idempotencyKeySchema.safeParse(value.trim());
  return parsed.success
    ? ({ key: parsed.data, valid: true } as const)
    : ({ key: null, valid: false } as const);
}

export function hashPitchCreationPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function pitchResponse(pitch: any, fallback: Record<string, any>) {
  return {
    id: pitch.id,
    publicId: pitch.public_id || null,
    hook: pitch.hook,
    description: pitch.description,
    startupName: pitch.startup_name || fallback.startupName || null,
    oneLinePitch: pitch.one_line_pitch || fallback.oneLinePitch,
    feedbackAsk: pitch.feedback_ask || fallback.feedbackAsk || null,
    extraContext: pitch.extra_context || fallback.extraContext || null,
    companyId: pitch.company_id || fallback.companyId || null,
    videoId: pitch.video_id,
    videoUrl: pitch.video_url,
    thumbnailUrl: pitch.thumbnail_url,
    duration: pitch.duration,
    status: pitch.status,
    versionNumber: pitch.take_version || pitch.version_number || fallback.repNumber || 1,
    practiceGoalId: pitch.practice_goal_id || fallback.practiceGoalId || null,
    promptKey: pitch.prompt_key || fallback.promptKey || null,
    promptText: pitch.prompt_text || fallback.promptText || null,
    createdAt: pitch.created_at,
  };
}

/**
 * POST /api/pitches
 * Create a new pitch
 *
 * Rate Limited: 10 requests per hour per IP
 *
 * Request body:
 * {
 *   "hook": "string (10-280 chars)",
 *   "startupName": "string (optional, max 120 chars)",
 *   "oneLinePitch": "string (optional, max 280 chars)",
 *   "feedbackAsk": "string (optional, max 220 chars)",
 *   "extraContext": "string (optional, max 800 chars)",
 *   "description": "string (optional, max 2000 chars)",
 *   "videoId": "string (Cloudflare video ID)",
 *   "playbackUrl": "string (HLS playback URL)",
 *   "thumbnailUrl": "string (optional thumbnail URL)",
 *   "duration": "number (30-60 seconds)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "pitch": {
 *     "id": "uuid",
 *     "hook": "string",
 *     "description": "string",
 *     "videoId": "string",
 *     "videoUrl": "string",
 *     "thumbnailUrl": "string",
 *     "duration": "number",
 *     "status": "published",
 *     "createdAt": "timestamp"
 *   }
 * }
 */
function slugifyCompanyName(name: string, userId: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'startup'}-${userId.replace(/-/g, '').slice(0, 8)}`;
}

async function resolveCompanyId(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  companyId: string | null | undefined,
  startupName: string
) {
  if (companyId) {
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .eq('founder_id', userId)
      .maybeSingle();
    return data?.id || null;
  }

  if (!startupName) return null;

  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('founder_id', userId)
    .ilike('name', startupName)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('companies')
    .insert({
      founder_id: userId,
      name: startupName,
      slug: slugifyCompanyName(startupName, userId),
      tagline: null,
      description: null,
      industry: 'Other',
      stage: 'Idea',
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    console.error('Error creating lightweight company:', error);
    return null;
  }

  try {
    await supabase
      .from('company_members')
      .upsert(
        {
          company_id: created.id,
          user_id: userId,
          role: 'founder',
          is_primary: false,
        },
        { onConflict: 'company_id,user_id' }
      );
  } catch (memberError) {
    console.error('Error creating company membership:', memberError);
  }

  return created.id;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Apply rate limiting: 10 requests per hour per IP
  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.UPLOAD.limit,
    window: RATE_LIMITS.UPLOAD.window,
  });

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

    // Parse and validate request body
    const body = await request.json();
    const validation = pitchSchema.safeParse(body);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pitch data',
          errors,
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const pitchData = validation.data;
    const idempotency = parsePitchIdempotencyKey(request.headers.get('Idempotency-Key'));
    if (!idempotency.valid) {
      return NextResponse.json(
        { success: false, error: 'Idempotency-Key must be a valid UUID.' },
        { status: 400, headers: formatRateLimitHeaders(result) }
      );
    }
    const creationPayloadHash = idempotency.key ? hashPitchCreationPayload(pitchData) : null;

    // Event recordings bind to their event and start private to it. The
    // membership check is server-side: a client cannot attach a pitch to an
    // event it is not an active participant of.
    let eventTarget: { eventId: string } | null = null;
    if (pitchData.eventSlug) {
      const serviceSupabase = createServiceSupabase();
      if (!serviceSupabase) {
        return NextResponse.json(
          { success: false, error: 'Event recording is not configured in this environment.' },
          { status: 503, headers: formatRateLimitHeaders(result) }
        );
      }
      const { data: event, error: eventError } = await serviceSupabase
        .from('pitch_events')
        .select('id')
        .eq('slug', pitchData.eventSlug)
        .maybeSingle();
      if (eventError) {
        console.error('Event lookup for pitch creation failed:', eventError);
        return NextResponse.json(
          { success: false, error: 'Could not verify the event.' },
          { status: 500, headers: formatRateLimitHeaders(result) }
        );
      }
      if (!event) {
        return NextResponse.json(
          { success: false, error: 'That event no longer exists.' },
          { status: 404, headers: formatRateLimitHeaders(result) }
        );
      }
      const { data: participant, error: participantError } = await serviceSupabase
        .from('pitch_event_participants')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (participantError) {
        console.error('Event membership check for pitch creation failed:', participantError);
        return NextResponse.json(
          { success: false, error: 'Could not verify your event membership.' },
          { status: 500, headers: formatRateLimitHeaders(result) }
        );
      }
      if (!participant) {
        return NextResponse.json(
          { success: false, error: 'Join the event before recording for it.' },
          { status: 403, headers: formatRateLimitHeaders(result) }
        );
      }
      eventTarget = { eventId: event.id };
    }

    const parsedDescription = parsePitchDescription(pitchData.description);
    const startupName = pitchData.startupName || parsedDescription.startupName || '';
    const oneLinePitch = pitchData.oneLinePitch || pitchData.hook;
    const feedbackAsk = pitchData.feedbackAsk || parsedDescription.feedbackAsk || '';
    const extraContext = pitchData.extraContext || parsedDescription.context || '';

    if (idempotency.key) {
      const { data: existingPitch, error: replayLookupError } = await supabase
        .from('pitches')
        .select('*')
        .eq('user_id', user.id)
        .eq('creation_key', idempotency.key)
        .maybeSingle();

      if (replayLookupError) throw replayLookupError;
      if (existingPitch) {
        if (existingPitch.creation_payload_hash !== creationPayloadHash) {
          return NextResponse.json(
            { success: false, error: 'Idempotency-Key was already used with different pitch data.' },
            { status: 409, headers: formatRateLimitHeaders(result) }
          );
        }
        return NextResponse.json(
          {
            success: true,
            replayed: true,
            pitch: pitchResponse(existingPitch, {
              startupName,
              oneLinePitch,
              feedbackAsk,
              extraContext,
              practiceGoalId: pitchData.practiceGoalId,
            }),
          },
          { status: 200, headers: formatRateLimitHeaders(result) }
        );
      }
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many pitch uploads. Please try again later.',
        },
        {
          status: 429,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const companyId = await resolveCompanyId(supabase, user.id, pitchData.companyId, startupName);
    const prompt = getPromptForDate();
    const promptKey = pitchData.promptKey || prompt.key;
    const promptText = pitchData.promptText || prompt.prompt;

    let repNumber = 1;
    if (pitchData.practiceGoalId) {
      try {
        const { count } = await supabase
          .from('practice_reps')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('goal_id', pitchData.practiceGoalId);
        repNumber = (count || 0) + 1;
      } catch (error) {
        console.error('Error counting practice reps:', error);
      }
    } else {
      try {
        const { count } = await supabase
          .from('pitches')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'published');
        repNumber = (count || 0) + 1;
      } catch (error) {
        console.error('Error counting pitch reps:', error);
      }
    }

    // A caller may only attach a video they uploaded. Without this, anyone could
    // put someone else's video id on their own pitch — harmless while every
    // video is publicly playable, but once Phase 2 requires signed playback the
    // server would mint a valid token for a video they never uploaded.
    const ownershipClient = createServiceSupabase();
    if (!ownershipClient) {
      // Fail CLOSED. Skipping the check when the service client is missing
      // would let any caller attach a victim's video id — the exact escalation
      // this guard exists to stop.
      console.error('Video ownership check unavailable: no service client');
      return NextResponse.json(
        { success: false, error: 'Publishing is temporarily unavailable.', code: 'ownership_unavailable' },
        { status: 503, headers: formatRateLimitHeaders(result) }
      );
    }
    {
      const { data: videoOwner, error: videoOwnerError } = await ownershipClient
        .from('video_uploads')
        .select('user_id')
        .eq('video_id', pitchData.videoId)
        .maybeSingle();

      if (videoOwnerError) {
        console.error('Video ownership check failed:', videoOwnerError);
        return NextResponse.json(
          { success: false, error: 'Could not verify the uploaded video.', code: 'video_ownership_failed' },
          { status: 500, headers: formatRateLimitHeaders(result) }
        );
      }
      if (!videoOwner || videoOwner.user_id !== user.id) {
        // Require the row, do not merely reject a mismatch. Both issuers record
        // ownership and the migration backfilled every existing pitch, so a
        // missing row means the id did not come from this app for this user.
        // Allowing it would leave exactly the hole this guard exists to close.
        return NextResponse.json(
          { success: false, error: 'That video belongs to another account.', code: 'video_not_owned' },
          { status: 403, headers: formatRateLimitHeaders(result) }
        );
      }
    }

    // Insert pitch into database
    const insertPayload = {
      public_id: createPublicPitchId(),
      user_id: user.id,
      company_id: companyId,
      hook: pitchData.hook,
      description: pitchData.description || null,
      startup_name: startupName || null,
      one_line_pitch: oneLinePitch,
      feedback_ask: feedbackAsk || null,
      extra_context: extraContext || null,
      take_version: repNumber,
      video_id: pitchData.videoId,
      video_url: pitchData.playbackUrl,
      video_provider: pitchData.videoProvider || process.env.VIDEO_PROVIDER || 'cloudflare',
      thumbnail_url: pitchData.thumbnailUrl || null,
      duration: pitchData.duration,
      status: 'published',
      event_id: eventTarget?.eventId || null,
      visibility: eventTarget ? 'private' : 'public',
      version_number: repNumber,
      views_count: 0,
      roast_count: 0,
      toast_count: 0,
      interest_score: 50,
      practice_goal_id: pitchData.practiceGoalId || null,
      prompt_key: promptKey,
      prompt_text: promptText,
      creation_key: idempotency.key,
      creation_payload_hash: creationPayloadHash,
    };

    let insertResult = await supabase
      .from('pitches')
      .insert(insertPayload)
      .select()
      .single();

    if (!idempotency.key && insertResult.error && /public_id|company_id|startup_name|one_line_pitch|feedback_ask|extra_context|take_version|practice_goal_id|prompt_key|prompt_text|is_best_take|creation_key|creation_payload_hash|event_id|visibility/i.test(insertResult.error.message)) {
      const {
        public_id: _publicId,
        company_id: _companyId,
        startup_name: _startupName,
        one_line_pitch: _oneLinePitch,
        feedback_ask: _feedbackAsk,
        extra_context: _extraContext,
        take_version: _takeVersion,
        practice_goal_id: _practiceGoalId,
        prompt_key: _promptKey,
        prompt_text: _promptText,
        creation_key: _creationKey,
        creation_payload_hash: _creationPayloadHash,
        event_id: _eventId,
        visibility: _visibility,
        ...fallbackPayload
      } = insertPayload;

      insertResult = await supabase
        .from('pitches')
        .insert(fallbackPayload)
        .select()
        .single();
    }

    const { data: pitch, error: insertError } = insertResult;

    if (insertError?.code === '23505' && idempotency.key) {
      const { data: racedPitch, error: racedLookupError } = await supabase
        .from('pitches')
        .select('*')
        .eq('user_id', user.id)
        .eq('creation_key', idempotency.key)
        .maybeSingle();

      if (racedLookupError) throw racedLookupError;
      if (racedPitch) {
        if (racedPitch.creation_payload_hash !== creationPayloadHash) {
          return NextResponse.json(
            { success: false, error: 'Idempotency-Key was already used with different pitch data.' },
            { status: 409, headers: formatRateLimitHeaders(result) }
          );
        }
        return NextResponse.json(
          {
            success: true,
            replayed: true,
            pitch: pitchResponse(racedPitch, {
              startupName,
              oneLinePitch,
              feedbackAsk,
              extraContext,
              companyId,
              repNumber,
              practiceGoalId: pitchData.practiceGoalId,
              promptKey,
              promptText,
            }),
          },
          { status: 200, headers: formatRateLimitHeaders(result) }
        );
      }
    }

    if (insertError) {
      console.error('Error creating pitch:', insertError);
      throw insertError;
    }

    try {
      await supabase
        .from('practice_reps')
        .insert({
          user_id: user.id,
          goal_id: pitchData.practiceGoalId || null,
          pitch_id: pitch.id,
          prompt_key: promptKey,
          prompt_text: promptText,
          rep_number: repNumber,
          is_best_take: false,
        });
    } catch (error) {
      console.error('Error creating practice rep:', error);
    }

    // Update user's pitches count (non-fatal, fire and forget)
    try {
      await supabase.rpc('increment_user_pitches_count', {
        user_id: user.id,
      });
    } catch (error) {
      console.error('Error updating pitches count:', error);
      // Non-fatal error, don't throw
    }

    try {
      await supabase.rpc('update_user_streak', {
        user_id: user.id,
        activity_type: 'pitch_rep',
      });
    } catch (error) {
      console.error('Error updating pitch practice streak:', error);
    }

    return NextResponse.json(
      {
        success: true,
        replayed: false,
        pitch: pitchResponse(pitch, {
          startupName,
          oneLinePitch,
          feedbackAsk,
          extraContext,
          companyId,
          repNumber,
          practiceGoalId: pitchData.practiceGoalId,
          promptKey,
          promptText,
        }),
      },
      {
        status: 201,
        headers: formatRateLimitHeaders(result),
      }
    );
  } catch (error) {
    console.error('Error creating pitch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pitch',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}

/**
 * GET /api/pitches
 * Get feed of pitches (paginated)
 *
 * Query parameters:
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 *
 * Response:
 * {
 *   "success": true,
 *   "pitches": [...],
 *   "total": number,
 *   "page": number,
 *   "limit": number
 * }
 */
export async function GET(request: NextRequest) {
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
        { status: 401 }
      );
    }

    if (!(await isUserAllowedForPilot(user))) {
      return NextResponse.json(
        {
          success: false,
          error: INVITE_ONLY_MESSAGE,
          code: 'invite_required',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const userId = searchParams.get('userId');
    const videoId = searchParams.get('videoId');
    const publicId = searchParams.get('publicId');
    const pitchId = searchParams.get('pitchId');
    const eventSlug = searchParams.get('eventSlug');

    const offset = (page - 1) * limit;

    // Event-scoped listing: resolve the slug, then filter by event_id and let
    // RLS decide who sees what. Members read every take in their event
    // (including private ones); anyone else gains nothing beyond the access
    // they already had, because no policy is bypassed here.
    let eventScopeId: string | null = null;
    let peerFeedbackEnabled: boolean | undefined;
    if (eventSlug) {
      // Only the cohort listing is throttled: it is the one that can page a
      // whole event. Pitch detail, profile grids and the open feed share this
      // route and must not be collaterally limited.
      const cohortLimit = await rateLimit({
        key: `cohort-feed:${user.id}`,
        limit: RATE_LIMITS.API.limit,
        window: RATE_LIMITS.API.window,
      });
      if (!cohortLimit.success) {
        return NextResponse.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          { status: 429, headers: formatRateLimitHeaders(cohortLimit) }
        );
      }

      const { data: scopedEvent, error: scopedEventError } = await supabase
        .from('pitch_events')
        .select('id,peer_feedback_enabled,status')
        .eq('slug', eventSlug)
        .maybeSingle();
      if (scopedEventError) {
        console.error('Event scope lookup failed:', scopedEventError);
        return NextResponse.json(
          { success: false, error: 'Could not load the event feed.' },
          { status: 500 }
        );
      }
      if (!scopedEvent) {
        return NextResponse.json({ success: true, pitches: [], total: 0, page, limit });
      }
      eventScopeId = scopedEvent.id;
      // The feed hides the compose action when the organizer has turned peer
      // feedback off, so the founder never meets a form that would be rejected.
      peerFeedbackEnabled =
        scopedEvent.peer_feedback_enabled !== false && scopedEvent.status !== 'archived';
    }

    // Build query
    let countQuery = supabase
      .from('pitches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .is('deleted_at', null);

    const fullSelect = `
        id,
        public_id,
        hook,
        description,
        startup_name,
        one_line_pitch,
        feedback_ask,
        extra_context,
        take_version,
        company_id,
        video_id,
        video_url,
        thumbnail_url,
        duration,
        views_count,
        roast_count,
        toast_count,
        interest_score,
        version_number,
        practice_goal_id,
        prompt_key,
        prompt_text,
        is_best_take,
        visibility,
        event_id,
        pitch_events:event_id (
          slug
        ),
        created_at,
        user_id,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          username,
          public_handle
        ),
        feedback (
          id,
          user_id,
          type,
          content,
          reviewer_role,
          author:user_id (
            full_name
          ),
          feedback_quality_votes (
            rating
          ),
          created_at
        )
      `;

    const fallbackSelect = `
        id,
        hook,
        description,
        video_id,
        video_url,
        thumbnail_url,
        duration,
        views_count,
        roast_count,
        toast_count,
        interest_score,
        version_number,
        created_at,
        user_id,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          username
        ),
        feedback (
          id,
          user_id,
          type,
          content,
          created_at
        )
      `;

    const buildDataQuery = (select: string) => {
      let query = supabase
        .from('pitches')
        .select(select)
      .eq('status', 'published')
      .is('deleted_at', null);

      // The open feed and other users' profile grids list only
      // explicitly-public pitches. The caller's own listing keeps every
      // visibility (their portfolio), and direct fetches by id/publicId/
      // videoId rely on RLS instead, so owners and event members can still
      // open private event pitches.
      if (eventScopeId) {
        // Scoped to one event; RLS is the authorization boundary here.
        query = query.eq('event_id', eventScopeId);
      } else if (!videoId && !publicId && !pitchId && userId !== user.id) {
        query = query.eq('visibility', 'public');
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (videoId) {
        query = query.eq('video_id', videoId);
      }

      if (publicId) {
        query = query.eq('public_id', publicId);
      }

      if (pitchId) {
        query = query.eq('id', pitchId);
      }

      return query;
    };

    let dataQuery = buildDataQuery(fullSelect);

    if (eventScopeId) {
      countQuery = countQuery.eq('event_id', eventScopeId);
    } else if (!videoId && !publicId && !pitchId && userId !== user.id) {
      countQuery = countQuery.eq('visibility', 'public');
    }

    // Filter by userId if provided
    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    if (videoId) {
      countQuery = countQuery.eq('video_id', videoId);
    }

    if (publicId) {
      countQuery = countQuery.eq('public_id', publicId);
    }

    if (pitchId) {
      countQuery = countQuery.eq('id', pitchId);
    }

    // Get total count (exclude deleted pitches)
    const { count } = await countQuery;

    // Get paginated pitches (exclude deleted pitches)
    let { data: pitches, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error && /public_id|public_handle|startup_name|one_line_pitch|feedback_ask|extra_context|take_version|company_id|practice_goal_id|prompt_key|prompt_text|is_best_take|event_id|visibility/i.test(error.message)) {
      const fallbackResult = await buildDataQuery(fallbackSelect)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      pitches = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      throw error;
    }

    const trustedReviewerUserIds = [...new Set(
      (pitches || []).flatMap((pitch: any) =>
        (pitch.feedback || [])
          .filter((feedback: any) => feedback.reviewer_role === 'trusted_reviewer')
          .map((feedback: any) => feedback.user_id)
          .filter(Boolean)
      )
    )] as string[];
    const reviewerBadges = new Map<string, {
      title: string | null;
      organization: string | null;
      expertise: string[];
    }>();

    if (trustedReviewerUserIds.length) {
      const adminSupabase = createServiceSupabase();
      if (adminSupabase) {
        const { data: memberships, error: membershipError } = await adminSupabase
          .from('trusted_reviewer_memberships')
          .select('user_id,title,organization,expertise')
          .in('user_id', trustedReviewerUserIds);

        if (membershipError) {
          console.warn('Pitch feed loaded without trusted reviewer badges:', membershipError);
        } else {
          (memberships || []).forEach((membership: any) => {
            reviewerBadges.set(membership.user_id, {
              title: membership.title || null,
              organization: membership.organization || null,
              expertise: (membership.expertise || []).slice(0, 2),
            });
          });
        }
      }
    }

    // Sign playback AFTER RLS has decided which rows come back, so a token is
    // only ever minted for a video the caller is already allowed to watch.
    // Phase 1: videos still permit unsigned playback, so a mint failure leaves
    // the stored URL in place rather than breaking the player.
    const tokenStoreClient = createServiceSupabase();
    const signedVideoUrls = await signedUrlsForRows((pitches || []) as any[], {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
      // Shared so the feed cannot fan out into the account-wide Cloudflare
      // quota once per serverless instance. Absent store just means more mints,
      // never a failed response.
      store: tokenStoreClient ? createSupabaseTokenStore(tokenStoreClient) : undefined,
    });

    const enrichedPitches = (pitches || []).map((pitch: any) => ({
      ...pitch,
      ...(signedVideoUrls.get(pitch.video_id) ? {
        video_url: signedVideoUrls.get(pitch.video_id)!.playbackUrl,
        thumbnail_url: signedVideoUrls.get(pitch.video_id)!.thumbnailUrl,
      } : {}),
      feedback: (pitch.feedback || []).map((feedback: any) => {
        const vote = Array.isArray(feedback.feedback_quality_votes)
          ? feedback.feedback_quality_votes[0]
          : feedback.feedback_quality_votes;
        const isOwner = Boolean(user && pitch.user_id === user.id && feedback.user_id !== user.id);
        return {
          id: feedback.id,
          type: feedback.type,
          content: feedback.content,
          reviewer_role: feedback.reviewer_role || 'peer_founder',
          reviewer_badge: feedback.reviewer_role === 'trusted_reviewer'
            ? reviewerBadges.get(feedback.user_id) || null
            : null,
          created_at: feedback.created_at,
          display_role_only: true,
          can_rate_quality: isOwner,
          quality_rating: vote?.rating || null,
          quality_action: isOwner
            ? { href: `/api/feedback/${encodeURIComponent(feedback.id)}/quality`, method: 'PUT' }
            : null,
          feedback_quality_votes: undefined,
        };
      }),
    }));

    return NextResponse.json({
      success: true,
      pitches: enrichedPitches,
      total: count || 0,
      page,
      limit,
      ...(peerFeedbackEnabled === undefined ? {} : { peerFeedbackEnabled }),
    });
  } catch (error) {
    console.error('Error fetching pitches:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pitches',
      },
      { status: 500 }
    );
  }
}
