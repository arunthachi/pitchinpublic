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

function isSchemaCompatibilityError(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /column .* does not exist|schema cache|Could not find|violates foreign key constraint|practice_goals/i.test(message);
}

async function ensureProfile(supabase: ReturnType<typeof createSupabase>, user: any) {
  const email = user.email || `${user.id}@pitchinpublic.local`;
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Founder';

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email,
        full_name: fullName,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('Error ensuring profile for practice goal:', error);
  }
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

    await ensureProfile(supabase, user);

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
    const minimalPayload = {
      user_id: user.id,
      name: payload.name,
      context: payload.context,
      target_date: payload.target_date,
      focus: payload.focus,
      status: payload.status,
    };

    if (input.id) {
      let result = await supabase
        .from('practice_goals')
        .update(payload)
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (result.error && isSchemaCompatibilityError(result.error)) {
        result = await supabase
          .from('practice_goals')
          .update(minimalPayload)
          .eq('id', input.id)
          .eq('user_id', user.id)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      return NextResponse.json({ success: true, goal: result.data });
    }

    await supabase
      .from('practice_goals')
      .update({ status: 'archived' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    let result = await supabase
      .from('practice_goals')
      .insert(payload)
      .select()
      .single();

    if (result.error && isSchemaCompatibilityError(result.error)) {
      result = await supabase
        .from('practice_goals')
        .insert(minimalPayload)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true, goal: result.data }, { status: 201 });
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
