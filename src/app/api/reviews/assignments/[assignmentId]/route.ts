import { NextRequest, NextResponse } from 'next/server';
import { createMarketplaceClient, getMarketplaceUser } from '@/lib/review-marketplace-server';
import { applySignedUrls, signPrivateRows } from '@/lib/video-providers/sign-rows';

function detailObject(value: unknown): Record<string, any> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;
  const supabase = createMarketplaceClient(request);
  const auth = await getMarketplaceUser(supabase);

  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error, ...('code' in auth ? { code: auth.code } : {}) },
      { status: auth.status },
    );
  }

  const { data, error } = await supabase.rpc('get_review_assignment_detail', {
    target_assignment_id: assignmentId,
  });

  if (error) {
    console.error('Could not open review assignment:', error);
    const invalidated = /invalidated|no longer available|not actionable/i.test(error.message || '');
    return NextResponse.json(
      {
        success: false,
        code: invalidated ? 'assignment_invalidated' : 'assignment_unavailable',
        error: invalidated
          ? 'This pitch is no longer available for review. Your draft remains on this device.'
          : 'This assigned review is unavailable. Refresh the queue and try again.',
      },
      { status: invalidated ? 409 : 404 },
    );
  }

  const detail = detailObject(data);
  if (detail?.available === false && detail.status === 'invalidated') {
    return NextResponse.json(
      {
        success: false,
        code: 'assignment_invalidated',
        error: 'This pitch is no longer available for review. Your draft remains on this device.',
      },
      { status: 409 },
    );
  }
  const rawPitch = detailObject(detail?.pitch) || detail;
  if (!detail || !rawPitch?.public_id) {
    return NextResponse.json(
      { success: false, code: 'assignment_unavailable', error: 'This assigned review is unavailable.' },
      { status: 404 },
    );
  }

  const signed = await signPrivateRows([rawPitch]);
  const pitch = applySignedUrls(rawPitch, signed);
  return NextResponse.json({
    success: true,
    assignment: {
      assignmentId: detail.assignment_id || detail.id || assignmentId,
      status: detail.status,
      eventSlug: detail.event_slug || detail.event?.slug || null,
      eventName: detail.event_name || detail.event?.name || null,
    },
    pitch: {
      ...pitch,
      feedback: Array.isArray(pitch.feedback) ? pitch.feedback : [],
      feedbackState: pitch.feedbackState || pitch.feedback_state || 'available',
    },
  });
}
