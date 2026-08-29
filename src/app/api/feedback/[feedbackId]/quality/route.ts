import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createMarketplaceClient,
  getMarketplaceUser,
} from '@/lib/review-marketplace-server';

const qualitySchema = z.object({
  rating: z.enum(['useful', 'generic', 'not_helpful']),
});

export async function PUT(request: NextRequest, props: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await props.params;
  const supabase = createMarketplaceClient(request);
  const auth = await getMarketplaceUser(supabase);

  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error, ...('code' in auth ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const validation = qualitySchema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Rating must be useful, generic, or not_helpful.' },
      { status: 400 }
    );
  }

  const { data: authorization, error: authorizationError } = await supabase.rpc('can_rate_feedback', {
    target_feedback_id: feedbackId,
  });
  const decision = authorization && typeof authorization === 'object' && !Array.isArray(authorization)
    ? authorization as { allowed?: boolean; reason?: string; pitch_id?: string }
    : null;

  if (authorizationError) {
    console.error('Could not authorize feedback quality rating:', authorizationError);
    return NextResponse.json({ success: false, error: 'Could not authorize this rating.' }, { status: 500 });
  }

  if (!decision || decision.reason === 'not_found') {
    return NextResponse.json({ success: false, error: 'Feedback not found' }, { status: 404 });
  }

  if (!decision.allowed && decision.reason === 'not_owner') {
    return NextResponse.json(
      { success: false, error: 'Only the pitch owner can rate this feedback.' },
      { status: 403 }
    );
  }

  if (!decision.allowed && decision.reason === 'own_feedback') {
    return NextResponse.json({ success: false, error: 'You cannot rate your own feedback.' }, { status: 403 });
  }

  if (!decision.allowed || !decision.pitch_id) {
    return NextResponse.json({ success: false, error: 'This feedback cannot be rated.' }, { status: 403 });
  }

  const { data: vote, error: voteError } = await supabase
    .from('feedback_quality_votes')
    .upsert(
      {
        feedback_id: feedbackId,
        pitch_owner_user_id: auth.user.id,
        rating: validation.data.rating,
      },
      { onConflict: 'feedback_id' }
    )
    .select('feedback_id,rating,created_at')
    .single();

  if (voteError) {
    console.error('Error rating feedback:', voteError);
    return NextResponse.json({ success: false, error: 'Could not save feedback rating' }, { status: 500 });
  }

  const { count: usefulCount } = await supabase
    .from('feedback_quality_votes')
    .select('feedback_id,feedback!inner(pitch_id)', { count: 'exact', head: true })
    .eq('rating', 'useful')
    .eq('feedback.pitch_id', decision.pitch_id);

  return NextResponse.json({
    success: true,
    rating: {
      feedbackId: vote.feedback_id,
      value: vote.rating,
      createdAt: vote.created_at,
    },
    usefulFeedbackCount: usefulCount || 0,
  });
}
