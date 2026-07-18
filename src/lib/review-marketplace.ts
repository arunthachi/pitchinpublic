import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';

export type ReviewQualityRating = 'useful' | 'generic' | 'not_helpful';

export function createMarketplaceClient(request: NextRequest) {
  return createServerClient(
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
}

export async function getMarketplaceUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, status: 401, error: 'Authentication required' } as const;
  }

  if (!(await isUserAllowedForPilot(user))) {
    return { user: null, status: 403, error: INVITE_ONLY_MESSAGE, code: 'invite_required' } as const;
  }

  return { user, status: 200, error: null } as const;
}

const ROLE_SNAPSHOTS: Record<string, string> = {
  admin: 'organizer',
  builder: 'peer_founder',
  coach: 'coach',
  founder: 'peer_founder',
  investor: 'experienced_reviewer',
  judge: 'judge',
  mentor: 'mentor',
  organizer: 'organizer',
};

const ROLE_LABELS: Record<string, string> = {
  coach: 'Coach',
  experienced_reviewer: 'Experienced reviewer',
  judge: 'Judge',
  mentor: 'Mentor',
  organizer: 'Organizer',
  peer_founder: 'Peer founder',
  public_reviewer: 'Public reviewer',
};

export function reviewerRoleLabel(role: string) {
  return ROLE_LABELS[role] || ROLE_LABELS.peer_founder;
}

export async function reviewerRoleSnapshot(
  supabase: SupabaseClient,
  user: User,
  eventId?: string | null
) {
  if (eventId) {
    const { data: participant } = await supabase
      .from('pitch_event_participants')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (participant?.role) {
      return ROLE_SNAPSHOTS[participant.role] || 'peer_founder';
    }
  }

  const { data: roles } = await supabase
    .from('profile_roles')
    .select('role,is_primary')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false });

  const role = roles?.find((item) => item.is_primary)?.role || roles?.[0]?.role || 'founder';
  return ROLE_SNAPSHOTS[role] || 'peer_founder';
}

/**
 * Credits are pilot-only soft state. Rebuilding the projection from source rows
 * makes retries idempotent and repairs partial updates without an increment RPC.
 */
export async function reconcileReviewCredits(supabase: SupabaseClient, reviewerUserId: string) {
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from('feedback')
    .select('id')
    .eq('user_id', reviewerUserId);

  if (feedbackError) throw feedbackError;

  const feedbackIds = (feedbackRows || []).map((feedback) => feedback.id);
  let usefulCount = 0;
  let ratedCount = 0;

  if (feedbackIds.length) {
    const { data: votes, error: votesError } = await supabase
      .from('feedback_quality_votes')
      .select('rating')
      .in('feedback_id', feedbackIds);

    if (votesError) throw votesError;
    ratedCount = votes?.length || 0;
    usefulCount = votes?.filter((vote) => vote.rating === 'useful').length || 0;
  }

  const { data: existing, error: existingError } = await supabase
    .from('review_credits')
    .select('spent_count')
    .eq('user_id', reviewerUserId)
    .maybeSingle();

  if (existingError) throw existingError;

  const spentCount = Math.max(0, existing?.spent_count || 0);
  const { error: creditError } = await supabase.from('review_credits').upsert(
    {
      user_id: reviewerUserId,
      balance: Math.max(0, usefulCount - spentCount),
      pending_balance: Math.max(0, feedbackIds.length - ratedCount),
      earned_count: usefulCount,
      spent_count: spentCount,
    },
    { onConflict: 'user_id' }
  );

  if (creditError) throw creditError;
}
