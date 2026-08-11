import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';

export type DeckOwnerContext = {
  user: User;
  serviceSupabase: SupabaseClient;
  companyId: string;
};

/** Deck responses describe account state and gate a capability: never cache. */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export type DeckOwnerResult =
  | { ok: true; context: DeckOwnerContext }
  | { ok: false; response: NextResponse };

/**
 * The single place a deck request is bound to a company. Split out from the
 * guard below so the binding is testable on its own: a review noted that a
 * source-text assertion would still pass if the founder_id filter were dropped,
 * which is exactly the mistake that would hand one founder another's deck.
 *
 * `founderId` MUST come from the authenticated session, never from the request.
 */
export async function resolveOwnerCompany(
  serviceSupabase: Pick<SupabaseClient, 'from'>,
  founderId: string
) {
  const { data, error } = await serviceSupabase
    .from('companies')
    .select('id')
    .eq('founder_id', founderId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return { company: (data as { id: string } | null) ?? null, error };
}

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
        { success: false, error: 'Decks are not configured in this environment.', code: 'not_configured' },
        { status: 503, headers: NO_STORE }
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
      response: NextResponse.json(
        { success: false, error: 'Authentication required', code: 'unauthenticated' },
        { status: 401, headers: NO_STORE }
      ),
    };
  }
  if (!(await isUserAllowedForPilot(user))) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: INVITE_ONLY_MESSAGE, code: 'invite_required' },
        { status: 403, headers: NO_STORE }
      ),
    };
  }

  const { company, error: companyError } = await resolveOwnerCompany(serviceSupabase, user.id);

  if (companyError) {
    console.error('Deck company lookup failed:', companyError);
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Could not load your startup.', code: 'company_lookup_failed' },
        { status: 500, headers: NO_STORE }
      ),
    };
  }
  if (!company) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Set up your startup profile before adding a deck.', code: 'no_startup' },
        { status: 409, headers: NO_STORE }
      ),
    };
  }

  return { ok: true, context: { user, serviceSupabase, companyId: company.id } };
}
