import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { isUuidLike } from '@/lib/public-routes';

/**
 * GET /api/users/[userId]/profile
 * Fetch another user's public profile information
 * userId may be a legacy UUID or a public handle.
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
export async function GET(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
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
    // Fetch user profile from profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        username,
        public_handle,
        avatar_url,
        bio,
        website,
        twitter_handle,
        linkedin_url,
        created_at
      `
      )
      .eq(isUuidLike(params.userId) ? 'id' : 'public_handle', params.userId)
      .single();

    // Handle errors - PGRST116 means no rows found (user doesn't exist)
    if (error) {
      console.error(`Error fetching profile for userId ${params.userId}:`, error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'User profile not found. Please complete your profile setup.' },
          { status: 404 }
        );
      }
      throw error;
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch follower count
    const { count: followersCount, error: followerError } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', profile.id);

    // Fetch following count
    const { count: followingCount, error: followingError } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', profile.id);

    // Fetch pitches count
    const { count: pitchesCount, error: pitchesError } = await supabase
      .from('pitches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('deleted_at', null);

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        publicHandle: profile.public_handle || profile.username || profile.id,
        name: profile.full_name || 'Unknown User',
        avatar: profile.avatar_url || '',
        bio: profile.bio || null,
        website: profile.website || null,
        twitter: profile.twitter_handle || null,
        linkedin: profile.linkedin_url || null,
        followersCount: followerError ? 0 : followersCount || 0,
        followingCount: followingError ? 0 : followingCount || 0,
        pitchesCount: pitchesError ? 0 : pitchesCount || 0,
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
