import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export function createRequestSupabase(request: NextRequest) {
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

export function createServiceSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export async function requirePlatformAdmin(request: NextRequest) {
  const supabase = createRequestSupabase(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return { ok: false as const, status: 401, error: 'Sign in as a platform admin.' };
  }

  const adminSupabase = createServiceSupabase();

  if (!adminSupabase) {
    return { ok: false as const, status: 503, error: 'Platform admin is not configured in this environment.' };
  }

  const { data: adminRow, error: adminError } = await adminSupabase
    .from('platform_admins')
    .select('email,role')
    .eq('email', normalizeEmail(user.email))
    .eq('role', 'super_admin')
    .maybeSingle();

  if (adminError) {
    console.error('Platform admin lookup failed:', adminError);
    return { ok: false as const, status: 500, error: 'Could not verify platform admin access.' };
  }

  if (!adminRow) {
    return { ok: false as const, status: 403, error: 'Platform admin access required.' };
  }

  return { ok: true as const, user, adminSupabase };
}
