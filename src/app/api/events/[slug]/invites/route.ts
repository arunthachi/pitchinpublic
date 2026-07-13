import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const TEAM_MANAGER_ROLES = ['organizer', 'admin'];
const inviteSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['founder', 'organizer', 'admin', 'coach', 'mentor', 'judge']).default('founder'),
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

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.details, maybeError.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

    if (parts.length > 0) return parts.join(' ');
    if (typeof maybeError.code === 'string') return `Database error ${maybeError.code}`;
  }

  return 'Could not create invite.';
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

  const validation = inviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Add a valid email and role.' }, { status: 400 });
  }

  const { event, canManage } = await getEventAndAccess(supabase, params.slug, user.id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }
  if (!canManage) {
    return NextResponse.json({ success: false, error: 'Only event organizers and admins can create invites.' }, { status: 403 });
  }

  const inviteCode = createInviteCode();
  const { data: invitation, error } = await supabase
    .from('pitch_event_invitations')
    .insert({
      event_id: event.id,
      email: validation.data.email || null,
      role: validation.data.role,
      invite_code: inviteCode,
      invited_by: user.id,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating event invitation:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }

  const inviteUrl = `${request.nextUrl.origin}/events/${event.slug}?invite=${inviteCode}`;
  return NextResponse.json({ success: true, invitation, inviteUrl }, { status: 201 });
}
