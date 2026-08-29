import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import {
  FEEDBACK_HISTORY_RPC,
  type FeedbackHistoryRow,
  parseFeedbackHistoryQuery,
  serializeFeedbackHistory,
} from './_server';

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
    },
  );
}

export async function GET(request: NextRequest) {
  const query = parseFeedbackHistoryQuery(request.nextUrl.searchParams);
  if (!query.success) {
    return NextResponse.json(
      { success: false, error: query.error.issues[0]?.message || 'Invalid history query.' },
      { status: 400 },
    );
  }

  const supabase = createSupabase(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Sign in to view feedback you have given.' },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.rpc(FEEDBACK_HISTORY_RPC, {
    target_limit: query.data.limit + 1,
    target_before_created_at: query.data.beforeCreatedAt || null,
    target_before_id: query.data.beforeId || null,
  });

  if (error) {
    console.error('Error fetching authored feedback history:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load feedback you have given.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    ...serializeFeedbackHistory((data || []) as FeedbackHistoryRow[], query.data.limit),
  });
}
