import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { addressGuidanceActionSchema, firstGuidanceIssue } from '@/lib/pitch-guidance';

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const parsed = addressGuidanceActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !zUuid(actionId)) return NextResponse.json({ success: false, error: parsed.success ? 'Invalid guidance action.' : firstGuidanceIssue(parsed.error) }, { status: 400 });
  const { data, error } = await supabase.rpc('mark_pitch_guidance_action_addressed', { target_action_id: actionId, later_pitch_id: parsed.data.laterPitchId });
  if (error) return NextResponse.json({ success: false, error: 'A later take in the same event is required.' }, { status: 400 });
  return NextResponse.json({ success: true, action: data });
}

function zUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
