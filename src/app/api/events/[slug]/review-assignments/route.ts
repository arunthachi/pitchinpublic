import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const requestSchema = z.object({
  reviewsPerPitch: z.number().int().min(1).max(10).default(3),
});

function createSupabase(request: NextRequest) {
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

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = createSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const validation = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Reviews per pitch must be between 1 and 10.' }, { status: 400 });
  }

  const { data: event } = await supabase
    .from('pitch_events')
    .select('id,organizer_id,review_target')
    .eq('slug', slug)
    .maybeSingle();
  if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });

  const { data: participant } = await supabase
    .from('pitch_event_participants')
    .select('role,status')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const canManage = event.organizer_id === user.id
    || (participant?.status === 'active' && ['organizer', 'admin'].includes(participant.role));
  if (!canManage) return NextResponse.json({ success: false, error: 'Organizer or admin access required' }, { status: 403 });

  const target = event.review_target || validation.data.reviewsPerPitch;
  const { data, error } = await supabase.rpc('generate_review_assignments', {
    target_event_id: event.id,
    target_per_reviewer: target,
  });
  if (error) {
    console.error('Could not generate review assignments:', error);
    return NextResponse.json({ success: false, error: 'Could not assign submitted pitches for review.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, created: Array.isArray(data) ? data.length : 0 });
}
