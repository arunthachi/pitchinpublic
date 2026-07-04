import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { getPromptForDate, PRACTICE_PROMPTS } from '@/lib/practice';

const goalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  companyName: z.string().max(120).optional().nullable(),
  context: z.string().max(500).optional().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  focus: z.string().min(2).max(40).default('clarity'),
  eventId: z.string().uuid().optional().nullable(),
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

export async function POST(request: NextRequest) {
  const supabase = createSupabase(request);

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = goalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid practice goal',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input = validation.data;
    const prompt =
      PRACTICE_PROMPTS.find((item) => item.focus === input.focus) || getPromptForDate();

    const payload = {
      user_id: user.id,
      name: input.name.trim(),
      company_name: input.companyName?.trim() || null,
      context: input.context?.trim() || null,
      target_date: input.targetDate || null,
      event_id: input.eventId || null,
      focus: input.focus,
      current_prompt_key: prompt.key,
      prompt_started_on: new Date().toISOString().slice(0, 10),
      status: 'active',
    };

    if (input.id) {
      const { data, error } = await supabase
        .from('practice_goals')
        .update(payload)
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, goal: data });
    }

    await supabase
      .from('practice_goals')
      .update({ status: 'archived' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    const { data, error } = await supabase
      .from('practice_goals')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, goal: data }, { status: 201 });
  } catch (error) {
    console.error('Error saving practice goal:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save practice goal',
      },
      { status: 500 }
    );
  }
}
