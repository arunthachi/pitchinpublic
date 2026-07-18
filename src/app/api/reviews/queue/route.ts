import { NextRequest, NextResponse } from 'next/server';
import { createMarketplaceClient, getMarketplaceUser } from '@/lib/review-marketplace-server';

export async function GET(request: NextRequest) {
  const supabase = createMarketplaceClient(request);
  const auth = await getMarketplaceUser(supabase);

  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error, ...('code' in auth ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '3', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(10, Math.max(1, requestedLimit)) : 3;

  const loadAssignments = () =>
    supabase
      .from('review_assignments')
      .select(`
      id,
      status,
      assignment_reason,
      due_at,
      event_id,
      created_at,
      pitch:pitches!inner (
        public_id,
        user_id,
        hook,
        startup_name,
        one_line_pitch,
        feedback_ask,
        thumbnail_url,
        duration
      ),
      event:pitch_events (
        slug,
        name
      )
      `)
      .eq('reviewer_user_id', auth.user.id)
      .in('status', ['pending', 'started'])
      .neq('pitch.user_id', auth.user.id)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(limit);

  let [{ data, error }, { count: pendingCount, error: countError }, { data: creditRow, error: creditError }] = await Promise.all([
    loadAssignments(),
    supabase
      .from('review_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('reviewer_user_id', auth.user.id)
      .in('status', ['pending', 'started']),
    supabase
      .from('review_credits')
      .select('balance,pending_balance,earned_count,spent_count')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
  ]);

  if (!error && !data?.length) {
    const { error: claimError } = await supabase.rpc('claim_global_review_assignments', {
      target_count: limit,
    });

    if (claimError) {
      console.warn('Review queue could not claim additional pitches:', claimError);
    } else {
      const refreshed = await loadAssignments();
      data = refreshed.data;
      error = refreshed.error;
      const refreshedCount = await supabase
        .from('review_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_user_id', auth.user.id)
        .in('status', ['pending', 'started']);
      pendingCount = refreshedCount.count;
    }
  }

  if (error) {
    console.error('Error fetching review queue:', error);
    return NextResponse.json({ success: false, error: 'Could not load review queue' }, { status: 500 });
  }

  if (creditError) {
    console.warn('Review queue loaded without credit state:', creditError);
  }
  if (countError) {
    console.warn('Review queue loaded without an exact total:', countError);
  }

  const assignments = (data || []).flatMap((assignment: any) => {
    const pitch = Array.isArray(assignment.pitch) ? assignment.pitch[0] : assignment.pitch;
    const event = Array.isArray(assignment.event) ? assignment.event[0] : assignment.event;
    if (!pitch?.public_id) return [];

    return [{
      id: assignment.id,
      status: assignment.status,
      reason: assignment.assignment_reason,
      dueAt: assignment.due_at,
      createdAt: assignment.created_at,
      pitch: {
        publicId: pitch.public_id,
        href: `/pitch/${encodeURIComponent(pitch.public_id)}`,
        hook: pitch.hook,
        startupName: pitch.startup_name,
        oneLinePitch: pitch.one_line_pitch,
        feedbackAsk: pitch.feedback_ask,
        thumbnailUrl: pitch.thumbnail_url,
        duration: pitch.duration,
      },
      event: event ? { slug: event.slug, name: event.name } : null,
    }];
  });

  return NextResponse.json({
    success: true,
    assignments,
    count: pendingCount ?? assignments.length,
    pendingCount: pendingCount ?? assignments.length,
    credits: {
      available: Math.floor((creditRow?.balance || 0) / 2),
      pendingBalance: creditRow?.pending_balance || 0,
      earnedCount: creditRow?.earned_count || 0,
      spentCount: creditRow?.spent_count || 0,
      reviewsPerCredit: 2,
      progress: (creditRow?.balance || 0) % 2,
    },
  });
}
