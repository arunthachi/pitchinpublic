import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { createServiceSupabase } from '@/lib/admin';
import { buildFounderAnnouncementEmail } from '@/lib/event-announcements';
import { sendEmail } from '@/lib/email';

const MANAGER_ROLES = ['organizer', 'admin'];
const announcementSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  body: z.string().min(5).max(1200).trim(),
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

  return data?.status === 'active' && MANAGER_ROLES.includes(data.role);
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createSupabase(request);
  const serviceSupabase = createServiceSupabase();

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
    .select('id,name,description,focus,organizer_id')
    .eq('slug', params.slug)
    .single();

  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  const canPost = await canPostAnnouncement(supabase, event.id, event.organizer_id, user.id);
  if (!canPost) {
    return NextResponse.json({ success: false, error: 'Only organizers and admins can post founder announcements.' }, { status: 403 });
  }

  const { data: founders, error: foundersError } = await supabase
    .from('pitch_event_participants')
    .select(
      `
      user_id,
      profile:user_id (
        id,
        full_name,
        email
      )
    `
    )
    .eq('event_id', event.id)
    .eq('status', 'active')
    .eq('role', 'founder');

  if (foundersError) {
    console.error('Error loading founder recipients:', foundersError);
    return NextResponse.json({ success: false, error: 'Could not load founder recipients.' }, { status: 500 });
  }

  const founderEmails = Array.from(
    new Set(
      (founders || [])
        .map((participant: any) => participant.profile?.email?.trim())
        .filter((email: string | undefined): email is string => Boolean(email))
    )
  );

  const emailContent = buildFounderAnnouncementEmail({
    eventName: event.name,
    eventFocus: event.focus,
    title: validation.data.title,
    body: validation.data.body,
    eventDescription: event.description,
  });

  let emailStatus: 'unknown' | 'skipped' | 'sent' | 'failed' | 'not_configured' = 'unknown';
  let emailError: string | null = null;
  let emailSentAt: string | null = null;

  if (!founderEmails.length) {
    emailStatus = 'skipped';
    emailError = 'No active founders with email addresses were found for this event.';
  } else {
    const emailResults = await Promise.all(
      founderEmails.map((email) =>
        sendEmail({
          to: email,
          replyTo: user.email || undefined,
          ...emailContent,
        })
      )
    );
    const sentCount = emailResults.filter((result) => result.ok).length;
    const failedResults = emailResults.filter((result) => !result.ok);

    if (sentCount === founderEmails.length) {
      emailStatus = 'sent';
      emailError = null;
      emailSentAt = new Date().toISOString();
    } else if (failedResults.every((result) => result.status === 'not_configured')) {
      emailStatus = 'not_configured';
      emailError = 'Email is not configured in this environment.';
    } else {
      emailStatus = 'failed';
      emailError = sentCount
        ? `Sent to ${sentCount} of ${founderEmails.length} founders. ${failedResults[0]?.error || 'Some emails failed.'}`
        : failedResults[0]?.error || 'Email delivery failed.';
      emailSentAt = sentCount > 0 ? new Date().toISOString() : null;
    }
  }

  const { data: announcement, error } = await supabase
    .from('pitch_event_announcements')
    .insert({
      event_id: event.id,
      author_id: user.id,
      title: validation.data.title,
      body: validation.data.body,
      audience: 'founders',
      email_status: emailStatus,
      email_error: emailError,
      email_sent_at: emailSentAt,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating event announcement:', error);
    return NextResponse.json({ success: false, error: 'Could not post announcement.' }, { status: 500 });
  }

  if (serviceSupabase && announcement?.id) {
    const { error: syncError } = await serviceSupabase
      .from('pitch_event_announcements')
      .update({
        email_status: emailStatus,
        email_error: emailError,
        email_sent_at: emailSentAt,
      })
      .eq('id', announcement.id);

    if (syncError) {
      console.error('Error syncing event announcement delivery status:', syncError);
    }
  }

  return NextResponse.json(
    {
      success: true,
      announcement,
      emailStatus,
      emailError,
      recipientCount: founderEmails.length,
    },
    { status: 201 }
  );
}
