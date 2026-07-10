import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const TEAM_ROLES = ['organizer', 'admin', 'coach', 'mentor', 'judge'];
const announcementSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  body: z.string().min(5).max(1200).trim(),
  audience: z.enum(['all', 'founders', 'team']).default('all'),
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

async function canPostAnnouncement(supabase: ReturnType<typeof createSupabase>, eventId: string, organizerId: string, userId: string) {
  if (organizerId === userId) return true;

  const { data } = await supabase
    .from('pitch_event_participants')
    .select('role,status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  return data?.status === 'active' && TEAM_ROLES.includes(data.role);
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const validation = announcementSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Add a short title and announcement.' }, { status: 400 });
  }

  const { data: event } = await supabase
    .from('pitch_events')
    .select('id,organizer_id')
    .eq('slug', params.slug)
    .single();

  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  const canPost = await canPostAnnouncement(supabase, event.id, event.organizer_id, user.id);
  if (!canPost) {
    return NextResponse.json({ success: false, error: 'Only event team members can post announcements.' }, { status: 403 });
  }

  const { data: announcement, error } = await supabase
    .from('pitch_event_announcements')
    .insert({
      event_id: event.id,
      author_id: user.id,
      title: validation.data.title,
      body: validation.data.body,
      audience: validation.data.audience,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating event announcement:', error);
    return NextResponse.json({ success: false, error: 'Could not post announcement.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, announcement }, { status: 201 });
}
