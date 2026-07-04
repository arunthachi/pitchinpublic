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

export async function POST(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
  const params = await props.params;
  const supabase = createSupabase(request);

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id,user_id,practice_goal_id')
      .eq('id', params.pitchId)
      .single();

    if (pitchError || !pitch || pitch.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Pitch not found' }, { status: 404 });
    }

    const { error: rpcError } = await supabase.rpc('mark_best_take', {
      target_pitch_id: params.pitchId,
    });

    if (rpcError) {
      console.error('mark_best_take RPC failed, using fallback:', rpcError);

      let pitchQuery = supabase
        .from('pitches')
        .update({ is_best_take: false })
        .eq('user_id', user.id);

      if (pitch.practice_goal_id) {
        pitchQuery = pitchQuery.eq('practice_goal_id', pitch.practice_goal_id);
      }

      await pitchQuery;

      await supabase
        .from('pitches')
        .update({ is_best_take: true })
        .eq('id', params.pitchId)
        .eq('user_id', user.id);

      let repQuery = supabase
        .from('practice_reps')
        .update({ is_best_take: false })
        .eq('user_id', user.id);

      if (pitch.practice_goal_id) {
        repQuery = repQuery.eq('goal_id', pitch.practice_goal_id);
      } else {
        repQuery = repQuery.is('goal_id', null);
      }

      await repQuery;

      await supabase
        .from('practice_reps')
        .update({ is_best_take: true })
        .eq('pitch_id', params.pitchId)
        .eq('user_id', user.id);

      if (pitch.practice_goal_id) {
        await supabase
          .from('practice_goals')
          .update({ best_pitch_id: params.pitchId })
          .eq('id', pitch.practice_goal_id)
          .eq('user_id', user.id);
      }
    }

    return NextResponse.json({ success: true, pitchId: params.pitchId });
  } catch (error) {
    console.error('Error marking best take:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark best take',
      },
      { status: 500 }
    );
  }
}
