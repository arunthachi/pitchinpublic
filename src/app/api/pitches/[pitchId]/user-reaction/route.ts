import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * GET /api/pitches/[pitchId]/user-reaction
 * Get the current user's reaction to a pitch (if any)
 *
 * Response:
 * {
 *   "reaction": "roast" | "toast" | null,
 *   "reactionId": "uuid" | null
 * }
 */
export async function GET(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
  const params = await props.params;
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
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Not authenticated - no reaction
      return NextResponse.json({
        reaction: null,
        reactionId: null,
      });
    }

    // Get user's reaction to this pitch
    const { data: userReaction, error } = await supabase
      .from('reactions')
      .select('id, type')
      .eq('pitch_id', params.pitchId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No reaction found - this is expected
      return NextResponse.json({
        reaction: null,
        reactionId: null,
      });
    }

    return NextResponse.json({
      reaction: userReaction?.type || null,
      reactionId: userReaction?.id || null,
    });
  } catch (error) {
    console.error('Error fetching user reaction:', error);
    return NextResponse.json(
      {
        reaction: null,
        reactionId: null,
      },
      { status: 500 }
    );
  }
}
