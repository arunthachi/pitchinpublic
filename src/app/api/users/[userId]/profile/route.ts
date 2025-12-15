import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/users/[userId]/profile
 * Fetch another user's public profile information
 *
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "id": string,
 *     "name": string,
 *     "email": string,
 *     "avatar": string,
 *     "bio": string | null,
 *     "website": string | null,
 *     "twitter": string | null,
 *     "linkedin": string | null,
 *     "followersCount": number,
 *     "followingCount": number,
 *     "pitchesCount": number,
 *     "createdAt": string
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
    // Fetch user profile from profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        avatar_url,
        bio,
        website,
        twitter,
        linkedin,
        created_at,
        email
      `
      )
      .eq('id', params.userId)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch follower count
    const { data: followers, error: followerError } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', params.userId);

    const followersCount = !followerError && followers ? followers.length : 0;

    // Fetch following count
    const { data: following, error: followingError } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', params.userId);

    const followingCount = !followingError && following ? following.length : 0;

    // Fetch pitches count
    const { data: pitches, error: pitchesError } = await supabase
      .from('pitches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', params.userId)
      .eq('deleted_at', null);

    const pitchesCount = !pitchesError && pitches ? pitches.length : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        name: profile.full_name || 'Unknown User',
        email: profile.email || '',
        avatar: profile.avatar_url || '',
        bio: profile.bio || null,
        website: profile.website || null,
        twitter: profile.twitter || null,
        linkedin: profile.linkedin || null,
        followersCount,
        followingCount,
        pitchesCount,
        createdAt: profile.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
