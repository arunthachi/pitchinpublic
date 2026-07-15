import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const TEAM_MANAGER_ROLES = ['organizer', 'admin'] as const;
const PARTICIPANT_ROLES = ['founder', 'organizer', 'admin', 'coach', 'mentor', 'judge'] as const;
const PARTICIPANT_STATUSES = ['active', 'removed'] as const;

const participantUpdateSchema = z.object({
  participantId: z.string().uuid(),
  role: z.enum(PARTICIPANT_ROLES).optional(),
  status: z.enum(PARTICIPANT_STATUSES).optional(),
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

async function getEventAndAccess(supabase: ReturnType<typeof createSupabase>, slug: string, userId: string) {
  const { data: event } = await supabase
    .from('pitch_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!event) return { event: null, canManage: false };

  if (event.organizer_id === userId) {
    return { event, canManage: true };
  }

  const { data: participant } = await supabase
    .from('pitch_event_participants')
    .select('role,status')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .maybeSingle();

  return {
    event,
    canManage: participant?.status === 'active' && TEAM_MANAGER_ROLES.includes(participant.role),
  };
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: 'Event participant management is not configured in this environment.' },
      { status: 503 }
    );
  }

  const params = await props.params;
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const validation = participantUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Choose a valid participant update.' }, { status: 400 });
  }

  const { event, canManage } = await getEventAndAccess(supabase, params.slug, user.id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }
  if (!canManage) {
    return NextResponse.json({ success: false, error: 'Only event organizers and admins can manage participants.' }, { status: 403 });
  }

  const { data: participant, error: participantError } = await supabase
    .from('pitch_event_participants')
    .select('*')
    .eq('id', validation.data.participantId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (participantError) {
    console.error('Participant lookup failed:', participantError);
    return NextResponse.json({ success: false, error: 'Could not load that participant.' }, { status: 500 });
  }

  if (!participant) {
    return NextResponse.json({ success: false, error: 'Participant not found.' }, { status: 404 });
  }

  if (participant.user_id === event.organizer_id) {
    return NextResponse.json({ success: false, error: 'The event organizer account cannot be changed here.' }, { status: 400 });
  }

  const hasRoleUpdate = typeof validation.data.role !== 'undefined';
  const hasStatusUpdate = typeof validation.data.status !== 'undefined';

  if (!hasRoleUpdate && !hasStatusUpdate) {
    return NextResponse.json({ success: false, error: 'Choose a role or status change.' }, { status: 400 });
  }

  if (participant.role === 'founder' && hasRoleUpdate && validation.data.role !== 'founder') {
    return NextResponse.json({ success: false, error: 'Founder participants can only be removed or restored.' }, { status: 400 });
  }

  if (participant.role !== 'founder' && hasRoleUpdate && validation.data.role === 'founder') {
    return NextResponse.json({ success: false, error: 'Team members cannot be converted into founders from this screen.' }, { status: 400 });
  }

  const { data: updatedParticipant, error: updateError } = await supabase
    .from('pitch_event_participants')
    .update({
      ...(hasRoleUpdate ? { role: validation.data.role } : {}),
      ...(hasStatusUpdate ? { status: validation.data.status } : {}),
    })
    .eq('id', participant.id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Participant update failed:', updateError);
    return NextResponse.json({ success: false, error: 'Could not update that participant.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    participant: updatedParticipant,
  });
}
