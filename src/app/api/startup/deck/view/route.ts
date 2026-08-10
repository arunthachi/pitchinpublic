import { NextRequest, NextResponse } from 'next/server';
import { requireDeckOwnerContext } from '@/lib/deck-owner';
import {
  DECK_BUCKET,
  DECK_SIGNED_URL_SECONDS,
  safeDownloadName,
  toDeckSummary,
} from '@/lib/pitch-deck';
import { rateLimit, RATE_LIMITS } from '@/lib/ratelimit';

/**
 * GET /api/startup/deck/view — a short-lived URL for the caller's OWN deck.
 * Owner-only by construction: requireDeckOwnerContext resolves the company from
 * the authenticated user, so there is no caller-supplied identifier to forge.
 */
export async function GET(request: NextRequest) {
  const owner = await requireDeckOwnerContext(request);
  if (!owner.ok) return owner.response;
  const { user, serviceSupabase, companyId } = owner.context;

  const limit = await rateLimit({
    key: `own-deck-view:${user.id}`,
    limit: RATE_LIMITS.API.limit,
    window: RATE_LIMITS.API.window,
  });
  if (!limit.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again shortly.' },
      { status: 429 }
    );
  }

  const { data: deck, error } = await serviceSupabase
    .from('startup_decks')
    .select('kind, file_name, link_url, storage_path, updated_at')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('Deck view lookup failed:', error);
    return NextResponse.json({ success: false, error: 'Could not load your deck.' }, { status: 500 });
  }
  if (!deck) {
    return NextResponse.json({ success: false, error: 'No deck uploaded yet.' }, { status: 404 });
  }

  if (deck.kind === 'link') {
    if (!deck.link_url) {
      return NextResponse.json({ success: false, error: 'Deck link is unavailable.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deck: toDeckSummary(deck), url: deck.link_url });
  }

  if (!deck.storage_path) {
    return NextResponse.json({ success: false, error: 'Deck file is unavailable.' }, { status: 404 });
  }

  const storedExtension = deck.storage_path.split('.').pop() || '';
  const { data: signed, error: signError } = await serviceSupabase.storage
    .from(DECK_BUCKET)
    .createSignedUrl(deck.storage_path, DECK_SIGNED_URL_SECONDS, {
      download: safeDownloadName(deck.file_name, storedExtension),
    });

  if (signError || !signed?.signedUrl) {
    console.error('Deck signing failed:', signError);
    return NextResponse.json({ success: false, error: 'Could not open your deck.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deck: toDeckSummary(deck), url: signed.signedUrl });
}
