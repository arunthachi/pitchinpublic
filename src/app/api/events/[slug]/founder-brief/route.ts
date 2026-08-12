import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { firstGuidanceIssue, founderBriefSchema } from '@/lib/pitch-guidance';

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const { data: event } = await supabase.from('pitch_events').select('id').eq('slug', slug).maybeSingle();
  if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const { data, error } = await supabase.from('event_founder_pitch_briefs').select('*').eq('event_id', event.id).eq('founder_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ success: false, error: 'Could not load pitch brief.' }, { status: 500 });
  return NextResponse.json({ success: true, brief: data || null });
}

export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const parsed = founderBriefSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstGuidanceIssue(parsed.error) }, { status: 400 });
  const { data: event } = await supabase.from('pitch_events').select('id').eq('slug', slug).maybeSingle();
  if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const value = parsed.data;
  const { data, error } = await supabase.rpc('save_event_founder_pitch_brief', {
    target_event_id: event.id, brief_tagline: value.tagline, brief_stage: value.businessStage,
    brief_industry: value.industry, brief_description: value.businessDescription,
    brief_problem: value.problem, brief_ask: value.ask,
  });
  if (error) {
    const forbidden = error.message.includes('Active founder access');
    return NextResponse.json({ success: false, error: forbidden ? error.message : 'Could not save pitch brief.' }, { status: forbidden ? 403 : 500 });
  }
  return NextResponse.json({ success: true, brief: data });
}
