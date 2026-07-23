import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeEmail, requirePlatformAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const accessSchema = z.object({
  reviewerEmail: z.string().trim().email().max(320),
  eventSlug: z.string().trim().min(1).max(180),
});

async function resolveAccess(adminSupabase: SupabaseClient, reviewerEmail: string, eventSlug: string) {
  const email = normalizeEmail(reviewerEmail);
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (!profile) return { error: 'An active reviewer account is required.', status: 404 };

  const { data: membership } = await adminSupabase
    .from('trusted_reviewer_memberships')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return { error: 'An active reviewer account is required.', status: 404 };

  const { data: event } = await adminSupabase
    .from('pitch_events')
    .select('id,name,slug')
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'Pitch event was not found.', status: 404 };

  return { membership, event, email, profileId: profile.id };
}

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });
  const parsed = accessSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Choose a reviewer and event.' }, { status: 400 });

  const resolved = await resolveAccess(admin.adminSupabase, parsed.data.reviewerEmail, parsed.data.eventSlug);
  if ('error' in resolved) return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });

  const { error } = await admin.adminSupabase.from('trusted_reviewer_event_access').upsert({
    membership_id: resolved.membership.id,
    event_id: resolved.event.id,
    granted_by: admin.user.id,
  }, { onConflict: 'membership_id,event_id' });
  if (error) return NextResponse.json({ success: false, error: 'Could not grant event access.' }, { status: 500 });
  return NextResponse.json({ success: true, reviewerEmail: resolved.email, event: { name: resolved.event.name, slug: resolved.event.slug } });
}

export async function DELETE(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });
  const parsed = accessSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Choose a reviewer and event.' }, { status: 400 });

  const resolved = await resolveAccess(admin.adminSupabase, parsed.data.reviewerEmail, parsed.data.eventSlug);
  if ('error' in resolved) return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
  const { error } = await admin.adminSupabase
    .from('trusted_reviewer_event_access')
    .delete()
    .eq('membership_id', resolved.membership.id)
    .eq('event_id', resolved.event.id);
  if (error) return NextResponse.json({ success: false, error: 'Could not revoke event access.' }, { status: 500 });
  const { error: assignmentError } = await admin.adminSupabase
    .from('review_assignments')
    .delete()
    .eq('reviewer_user_id', resolved.profileId)
    .eq('event_id', resolved.event.id)
    .in('status', ['pending', 'started']);
  if (assignmentError) {
    console.warn('Reviewer event access revoked with stale unfinished assignments:', assignmentError);
  }
  return NextResponse.json({ success: true });
}
