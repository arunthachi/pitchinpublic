import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { createRequestSupabase } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  dailyNudgeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .optional(),
  timezone: z.string().min(3).max(128).optional(),
});

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

type SessionResult =
  | {
      supabase: ReturnType<typeof createRequestSupabase>;
      user: User;
      error: null;
    }
  | {
      supabase: ReturnType<typeof createRequestSupabase>;
      user: null;
      error: string;
    };

async function ensureProfile(supabase: ReturnType<typeof createRequestSupabase>, user: Pick<User, 'id' | 'email' | 'user_metadata'>) {
  const email = user.email || `${user.id}@pitchinpublic.local`;
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Founder';

  const { error } = await supabase.from('profiles').upsert(
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
    console.error('Notification preference profile upsert failed:', error);
  }
}

async function loadSessionUser(request: NextRequest): Promise<SessionResult> {
  if (!hasSupabaseConfig()) {
    return {
      supabase: null as unknown as ReturnType<typeof createRequestSupabase>,
      user: null,
      error: 'Supabase is not configured in this environment.',
    };
  }

  const supabase = createRequestSupabase(request);

  if (!supabase) {
    return {
      supabase: null as unknown as ReturnType<typeof createRequestSupabase>,
      user: null,
      error: 'Supabase is not configured in this environment.',
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, error: error?.message || 'Authentication required' };
  }

  return { supabase, user, error: null };
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { success: false, error: 'Supabase is not configured in this environment.' },
      { status: 503 }
    );
  }

  const session = await loadSessionUser(request);

  if (!session.user) {
    return NextResponse.json({ success: false, error: session.error }, { status: 401 });
  }

  await ensureProfile(session.supabase, session.user);

  const { data, error } = await session.supabase
    .from('notification_preferences')
    .select('user_id,email_enabled,daily_nudge_time,timezone,created_at,updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message || 'Could not load preferences.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    preferences: data || {
      user_id: session.user.id,
      email_enabled: true,
      daily_nudge_time: '09:00:00',
      timezone: 'America/New_York',
      created_at: null,
      updated_at: null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { success: false, error: 'Supabase is not configured in this environment.' },
      { status: 503 }
    );
  }

  const session = await loadSessionUser(request);

  if (!session.user) {
    return NextResponse.json({ success: false, error: session.error }, { status: 401 });
  }

  await ensureProfile(session.supabase, session.user);

  const body = await request.json().catch(() => ({}));
  const validation = updateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid notification preference update.',
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { data: existingPreferences, error: existingError } = await session.supabase
    .from('notification_preferences')
    .select('email_enabled,daily_nudge_time,timezone')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { success: false, error: existingError.message || 'Could not load preferences before saving.' },
      { status: 500 }
    );
  }

  const payload = {
    user_id: session.user.id,
    email_enabled: validation.data.emailEnabled ?? existingPreferences?.email_enabled ?? true,
    daily_nudge_time: validation.data.dailyNudgeTime || existingPreferences?.daily_nudge_time || '09:00:00',
    timezone: validation.data.timezone || existingPreferences?.timezone || 'America/New_York',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await session.supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('user_id,email_enabled,daily_nudge_time,timezone,created_at,updated_at')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message || 'Could not save preferences.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    preferences: data,
  });
}
