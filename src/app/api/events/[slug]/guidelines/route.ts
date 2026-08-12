import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { firstGuidanceIssue, publishGuidelinesSchema } from '@/lib/pitch-guidance';

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
}

async function eventIdForSlug(supabase: ReturnType<typeof client>, slug: string) {
  const { data } = await supabase.from('pitch_events').select('id').eq('slug', slug).maybeSingle();
  return data?.id as string | undefined;
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const { data, error } = await supabase.from('event_pitch_guideline_versions').select('*').eq('event_id', eventId).order('version', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: 'Could not load pitch guidelines.' }, { status: 500 });
  return NextResponse.json({ success: true, guidelines: data || [] });
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const parsed = publishGuidelinesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstGuidanceIssue(parsed.error) }, { status: 400 });
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const { data, error } = await supabase.rpc('publish_event_pitch_guidelines', {
    target_event_id: eventId,
    guideline_title: parsed.data.title,
    guideline_instructions: parsed.data.instructions,
    guideline_criteria: parsed.data.criteria,
    disclosure: parsed.data.disclosureMode,
  });
  if (error) {
    const forbidden = error.message.includes('manager access');
    return NextResponse.json({ success: false, error: forbidden ? 'Event manager access required' : 'Could not publish pitch guidelines.' }, { status: forbidden ? 403 : 500 });
  }
  return NextResponse.json({ success: true, guideline: data }, { status: 201 });
}
