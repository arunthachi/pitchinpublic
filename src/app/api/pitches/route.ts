import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { pitchSchema } from '@/lib/validation';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { getPromptForDate } from '@/lib/practice';
import { parsePitchDescription } from '@/lib/pitch-copy';
import { createPublicPitchId } from '@/lib/public-routes';

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
    const parsedDescription = parsePitchDescription(pitchData.description);
    const startupName = pitchData.startupName || parsedDescription.startupName || '';
    const oneLinePitch = pitchData.oneLinePitch || pitchData.hook;
    const feedbackAsk = pitchData.feedbackAsk || parsedDescription.feedbackAsk || '';
    const extraContext = pitchData.extraContext || parsedDescription.context || '';
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
      version_number: repNumber,
      views_count: 0,
      roast_count: 0,
      toast_count: 0,
      interest_score: 50,
      practice_goal_id: pitchData.practiceGoalId || null,
      prompt_key: promptKey,
      prompt_text: promptText,
    };

    let insertResult = await supabase
      .from('pitches')
      .insert(insertPayload)
      .select()
      .single();

    if (insertResult.error && /public_id|company_id|startup_name|one_line_pitch|feedback_ask|extra_context|take_version|practice_goal_id|prompt_key|prompt_text|is_best_take/i.test(insertResult.error.message)) {
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
        ...fallbackPayload
      } = insertPayload;

      insertResult = await supabase
        .from('pitches')
        .insert(fallbackPayload)
        .select()
        .single();
    }

    const { data: pitch, error: insertError } = insertResult;

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
        pitch: {
          id: pitch.id,
          publicId: pitch.public_id || null,
          hook: pitch.hook,
          description: pitch.description,
          startupName: pitch.startup_name || startupName || null,
          oneLinePitch: pitch.one_line_pitch || oneLinePitch,
          feedbackAsk: pitch.feedback_ask || feedbackAsk || null,
          extraContext: pitch.extra_context || extraContext || null,
          companyId: pitch.company_id || companyId,
          videoId: pitch.video_id,
          videoUrl: pitch.video_url,
          thumbnailUrl: pitch.thumbnail_url,
          duration: pitch.duration,
          status: pitch.status,
          versionNumber: pitch.take_version || pitch.version_number || repNumber,
          practiceGoalId: pitch.practice_goal_id || pitchData.practiceGoalId || null,
          promptKey,
          promptText,
          createdAt: pitch.created_at,
        },
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
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const userId = searchParams.get('userId');
    const videoId = searchParams.get('videoId');
    const publicId = searchParams.get('publicId');
    const pitchId = searchParams.get('pitchId');

    const offset = (page - 1) * limit;

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
          created_at
        )
      `;

    const fallbackSelect = `
        id,
        hook,
        description,
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

    if (error && /public_id|public_handle|startup_name|one_line_pitch|feedback_ask|extra_context|take_version|company_id|practice_goal_id|prompt_key|prompt_text|is_best_take/i.test(error.message)) {
      const fallbackResult = await buildDataQuery(fallbackSelect)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      pitches = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      pitches: pitches || [],
      total: count || 0,
      page,
      limit,
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
