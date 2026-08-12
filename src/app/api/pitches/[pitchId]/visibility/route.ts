import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequestSupabase } from '@/lib/admin';
import { isUuidLike } from '@/lib/pitch-deck';
import { formatRateLimitHeaders, rateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { getVideoProvider } from '@/lib/video-providers';

export const visibilityUpdateSchema = z
  .object({
    visibility: z.enum(['public', 'private']),
  })
  .strict();

/**
 * The authorization contract, exported for tests: the update is scoped to the
 * owner's own non-deleted pitch — a non-owner's request matches zero rows and
 * surfaces as the same 404 a missing pitch produces.
 */
export function ownerScopedVisibilityUpdate(
  supabase: NonNullable<ReturnType<typeof createRequestSupabase>>,
  input: { pitchId: string; userId: string; visibility: 'public' | 'private' }
) {
  return supabase
    .from('pitches')
    .update({ visibility: input.visibility, updated_at: new Date().toISOString() })
    .eq('id', input.pitchId)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .select('id, public_id, visibility, event_id, video_id')
    .maybeSingle();
}

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
    userId: user.id,
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

  // Move playback enforcement with the row. Going private is what actually
  // revokes the URLs already in circulation — the whole point of this work.
  // Going public lifts it again so the founder gets a permanent, shareable
  // link for social.
  //
  // Deliberately AFTER the database write and non-fatal: the row is the source
  // of truth for what the app serves, and a Cloudflare blip must not leave the
  // founder unable to change their own visibility. A drifted video is repaired
  // by the reconcile below on the next toggle.
  let enforcementSynced = true;
  if (updated.video_id) {
    const provider = getVideoProvider();
    enforcementSynced = provider.setRequireSignedUrls
      ? await provider.setRequireSignedUrls(updated.video_id, updated.visibility === 'private')
      : false;
    if (!enforcementSynced) {
      console.error('Playback enforcement did not follow visibility:', {
        pitchId: updated.id,
        visibility: updated.visibility,
      });
    }
  }

  return NextResponse.json({
    // Surfaced so the client can warn rather than implying the old links are
    // dead when Cloudflare did not accept the change.
    enforcementSynced,
    success: true,
    pitch: { id: updated.id, publicId: updated.public_id, visibility: updated.visibility, eventId: updated.event_id },
  });
}
