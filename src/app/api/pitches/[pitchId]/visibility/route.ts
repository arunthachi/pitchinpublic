import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabase } from '@/lib/admin';
import { isUuidLike } from '@/lib/pitch-deck';
import { formatRateLimitHeaders, rateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { ownerScopedVisibilityUpdate, visibilityUpdateSchema } from './_server';

/**
 * POST /api/pitches/[pitchId]/visibility
 * Owner-only switch between the public feed and private. This is the
 * founder-controlled promotion path for event pitches: recording for an event
 * starts private, and only the founder may make a take publicly visible.
 * Enforcement rides the "Users can update their own pitches" RLS policy —
 * the update is scoped to auth.uid() and no service role is involved.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pitchId: string }> }
) {
  const { pitchId } = await params;
  if (!isUuidLike(pitchId)) {
    return NextResponse.json({ success: false, error: 'Pitch not found.' }, { status: 404 });
  }

  const supabase = createRequestSupabase(request);
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Pitch visibility is not configured in this environment.' },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const userLimit = await rateLimit({
    key: `pitch-visibility:${user.id}`,
    limit: RATE_LIMITS.API.limit,
    window: RATE_LIMITS.API.window,
  });
  if (!userLimit.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429, headers: formatRateLimitHeaders(userLimit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Send the visibility change.' }, { status: 400 });
  }

  const parsed = visibilityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Visibility must be public or private.' },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await ownerScopedVisibilityUpdate(supabase, {
    pitchId,
    visibility: parsed.data.visibility,
  });

  if (updateError) {
    console.error('Pitch visibility update failed:', updateError);
    return NextResponse.json(
      { success: false, error: 'Could not update visibility.' },
      { status: 500 }
    );
  }

  if (!updated) {
    // Not the owner or no such pitch — identical response for both.
    return NextResponse.json({ success: false, error: 'Pitch not found.' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    pitch: { id: updated.id, publicId: updated.public_id, visibility: updated.visibility, eventId: updated.event_id },
  });
}
