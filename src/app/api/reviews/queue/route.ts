import { NextRequest, NextResponse } from 'next/server';
import { createMarketplaceClient, getMarketplaceUser } from '@/lib/review-marketplace-server';
import { applySignedUrls, signPrivateRows } from '@/lib/video-providers/sign-rows';

type SnapshotAssignment = {
  assignment_id?: string;
  id?: string;
  status?: string;
  assignment_reason?: string | null;
  reason?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  event_slug?: string | null;
  event_name?: string | null;
  event?: { slug?: string | null; name?: string | null } | null;
  pitch?: Record<string, any> | null;
  [key: string]: any;
};

function snapshotObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function assignmentPitch(row: SnapshotAssignment) {
  if (row.pitch && typeof row.pitch === 'object') return row.pitch;
  return {
    id: row.pitch_id,
    public_id: row.public_id,
    user_id: row.user_id,
    hook: row.hook,
    startup_name: row.startup_name,
    one_line_pitch: row.one_line_pitch,
    feedback_ask: row.feedback_ask,
    video_id: row.video_id,
    video_url: row.video_url,
    visibility: row.visibility,
    thumbnail_url: row.thumbnail_url,
    duration: row.duration,
  };
}

export async function GET(request: NextRequest) {
  const supabase = createMarketplaceClient(request);
  const auth = await getMarketplaceUser(supabase);

  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error, ...('code' in auth ? { code: auth.code } : {}) },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '3', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(10, Math.max(1, requestedLimit)) : 3;
  const mode = searchParams.get('mode') === 'reviewer' ? 'reviewer' : 'founder';

  const { data, error } = await supabase.rpc('get_review_queue_snapshot', {
    target_limit: limit,
    target_mode: mode,
  });

  if (error) {
    console.error('Error fetching atomic review queue snapshot:', error);
    const status = error.message?.includes('Trusted reviewer access') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: status === 403 ? 'Trusted reviewer access is required.' : 'Could not load review queue' },
      { status },
    );
  }

  const snapshot = snapshotObject(data);
  const rows = Array.isArray(snapshot.assignments) ? snapshot.assignments as SnapshotAssignment[] : [];
  const pitches = rows.map(assignmentPitch).filter((pitch) => pitch?.public_id);
  const signedUrls = await signPrivateRows(pitches);

  const assignments = rows.flatMap((row) => {
    const pitch = applySignedUrls(assignmentPitch(row), signedUrls);
    const assignmentId = row.assignment_id || row.id;
    if (!assignmentId || !pitch?.public_id) return [];

    const eventSlug = row.event_slug ?? row.event?.slug ?? null;
    const eventName = row.event_name ?? row.event?.name ?? null;
    return [{
      assignmentId,
      status: row.status,
      reason: row.assignment_reason ?? row.reason ?? null,
      dueAt: row.due_at ?? null,
      createdAt: row.created_at ?? null,
      pitch: {
        id: pitch.id,
        publicId: pitch.public_id,
        href: `/pitch/${encodeURIComponent(pitch.public_id)}`,
        hook: pitch.hook,
        startupName: pitch.startup_name,
        oneLinePitch: pitch.one_line_pitch,
        feedbackAsk: pitch.feedback_ask,
        videoUrl: pitch.video_url,
        thumbnailUrl: pitch.thumbnail_url,
        duration: pitch.duration,
      },
      event: eventSlug ? { slug: eventSlug, name: eventName } : null,
    }];
  });

  const pendingCount = Number(snapshot.pendingCount ?? snapshot.pending_count ?? assignments.length);
  return NextResponse.json({
    success: true,
    assignments,
    count: Number.isFinite(pendingCount) ? pendingCount : assignments.length,
    pendingCount: Number.isFinite(pendingCount) ? pendingCount : assignments.length,
    credits: mode === 'reviewer' ? null : snapshot.credits ?? null,
  });
}
