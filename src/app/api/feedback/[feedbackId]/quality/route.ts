import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createMarketplaceClient,
  getMarketplaceUser,
  reconcileReviewCredits,
} from '@/lib/review-marketplace';

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

  const { data: feedback, error: feedbackError } = await supabase
    .from('feedback')
    .select('id,user_id,pitch_id,pitch:pitches!inner(user_id)')
    .eq('id', feedbackId)
    .maybeSingle();

  const pitch = Array.isArray(feedback?.pitch) ? feedback.pitch[0] : feedback?.pitch;
  if (feedbackError || !feedback || !pitch) {
    return NextResponse.json({ success: false, error: 'Feedback not found' }, { status: 404 });
  }

  if (pitch.user_id !== auth.user.id) {
    return NextResponse.json(
      { success: false, error: 'Only the pitch owner can rate this feedback.' },
      { status: 403 }
    );
  }

  if (feedback.user_id === auth.user.id) {
    return NextResponse.json({ success: false, error: 'You cannot rate your own feedback.' }, { status: 403 });
  }

  const { data: vote, error: voteError } = await supabase
    .from('feedback_quality_votes')
    .upsert(
      {
        feedback_id: feedback.id,
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

  try {
    await reconcileReviewCredits(supabase, feedback.user_id);
  } catch (error) {
    console.warn('Feedback rating saved, but credit projection could not be refreshed:', error);
  }

  const { count: usefulCount } = await supabase
    .from('feedback_quality_votes')
    .select('feedback_id,feedback!inner(pitch_id)', { count: 'exact', head: true })
    .eq('rating', 'useful')
    .eq('feedback.pitch_id', feedback.pitch_id);

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
