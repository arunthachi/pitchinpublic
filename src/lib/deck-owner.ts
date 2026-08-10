import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';

export type DeckOwnerContext = {
  user: User;
  serviceSupabase: SupabaseClient;
  companyId: string;
};

export type DeckOwnerResult =
  | { ok: true; context: DeckOwnerContext }
  | { ok: false; response: NextResponse };

/**
 * Resolve the caller's own active company for deck operations. Every deck route
 * that acts on "my deck" funnels through here so the pilot gate and the
 * founder→company binding are enforced in exactly one place.
 */
export async function requireDeckOwnerContext(request: NextRequest): Promise<DeckOwnerResult> {
  const supabase = createRequestSupabase(request);
  const serviceSupabase = createServiceSupabase();
  if (!supabase || !serviceSupabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Decks are not configured in this environment.' },
        { status: 503 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
    };
  }
  if (!(await isUserAllowedForPilot(user))) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: INVITE_ONLY_MESSAGE, code: 'invite_required' },
        { status: 403 }
      ),
    };
  }

  const { data: company, error: companyError } = await serviceSupabase
    .from('companies')
    .select('id')
    .eq('founder_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (companyError) {
    console.error('Deck company lookup failed:', companyError);
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Could not load your startup.' }, { status: 500 }),
    };
  }
  if (!company) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Set up your startup profile before adding a deck.' },
        { status: 409 }
      ),
    };
  }

  return { ok: true, context: { user, serviceSupabase, companyId: company.id } };
}
