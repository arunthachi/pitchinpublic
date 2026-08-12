import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { firstGuidanceIssue, selectGuidanceActionSchema } from '@/lib/pitch-guidance';

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
}

export async function POST(request: NextRequest) {
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const parsed = selectGuidanceActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstGuidanceIssue(parsed.error) }, { status: 400 });
  const { data, error } = await supabase.rpc('select_pitch_guidance_action', { target_feedback_id: parsed.data.feedbackId });
  if (error) return NextResponse.json({ success: false, error: 'Could not select that improvement.' }, { status: 400 });
  return NextResponse.json({ success: true, action: data }, { status: 201 });
}
