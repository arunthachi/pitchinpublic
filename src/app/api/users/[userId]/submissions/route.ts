import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

export async function GET(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const supabase = createSupabase(request);

  const { data, error } = await supabase
    .from('pitch_event_submissions')
    .select(
      `
      *,
      event:event_id (
        id,
        name,
        slug,
        event_date,
        visibility
      )
    `
    )
    .eq('user_id', params.userId)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json({ success: true, submissions: [] });
    }

    console.error('Error fetching user submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
  }

  return NextResponse.json({ success: true, submissions: data || [] });
}
