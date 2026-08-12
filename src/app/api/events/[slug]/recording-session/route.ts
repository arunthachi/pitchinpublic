import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', { cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} } });
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params; const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const { data: event } = await supabase.from('pitch_events').select('id').eq('slug', slug).maybeSingle();
  if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const { data, error } = await supabase.rpc('start_event_recording_session', { target_event_id: event.id });
  if (error) return NextResponse.json({ success: false, error: 'Published pitch standard and active event membership are required.' }, { status: 403 });
  return NextResponse.json({ success: true, session: { id: data.id, guidelineVersionId: data.guideline_version_id, expiresAt: data.expires_at } }, { status: 201 });
}
