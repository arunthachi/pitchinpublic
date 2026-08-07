import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabase, createServiceSupabase, normalizeEmail } from '@/lib/admin';
import {
  DECK_BUCKET,
  DECK_SIGNED_URL_SECONDS,
  canViewDeck,
  toDeckSummary,
} from '@/lib/pitch-deck';

/**
 * GET /api/events/[slug]/decks/[userId]
 * Resolve a founder's startup deck for an event team member: returns a
 * time-limited signed URL for uploaded files or the stored https link.
 * Authorization is deny-by-default via canViewDeck — owner, platform admin,
 * or an active team member of this event while the founder is an active
 * participant. 404 is returned for both "no deck" and "not allowed" so the
 * route does not confirm deck existence to unauthorized callers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const { slug, userId } = await params;

  const supabase = createRequestSupabase(request);
  const serviceSupabase = createServiceSupabase();
  if (!supabase || !serviceSupabase) {
    return NextResponse.json(
      { success: false, error: 'Decks are not configured in this environment.' },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { data: event, error: eventError } = await serviceSupabase
    .from('pitch_events')
    .select('id, organizer_id')
    .eq('slug', slug)
    .maybeSingle();
  if (eventError) {
    console.error('Deck event lookup failed:', eventError);
    return NextResponse.json({ success: false, error: 'Could not load the event.' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }

  const { data: participantRows, error: participantError } = await serviceSupabase
    .from('pitch_event_participants')
    .select('user_id, role, status')
    .eq('event_id', event.id)
    .in('user_id', user.id === userId ? [userId] : [user.id, userId]);
  if (participantError) {
    console.error('Deck participant lookup failed:', participantError);
    return NextResponse.json({ success: false, error: 'Could not load the event.' }, { status: 500 });
  }

  const requesterRow = participantRows?.find((row) => row.user_id === user.id) || null;
  const ownerRow = participantRows?.find((row) => row.user_id === userId) || null;

  let isPlatformAdmin = false;
  if (user.email) {
    const { data: adminRow } = await serviceSupabase
      .from('platform_admins')
      .select('email')
      .eq('email', normalizeEmail(user.email))
      .eq('role', 'super_admin')
      .maybeSingle();
    isPlatformAdmin = Boolean(adminRow);
  }

  const allowed = canViewDeck({
    requesterId: user.id,
    deckOwnerId: userId,
    isPlatformAdmin,
    event: {
      organizerId: event.organizer_id,
      requesterRole: requesterRow?.role,
      requesterStatus: requesterRow?.status,
      ownerRole: ownerRow?.role,
      ownerStatus: ownerRow?.status,
    },
  });
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }

  const { data: deck, error: deckError } = await serviceSupabase
    .from('startup_decks')
    .select('kind, file_name, link_url, storage_path, updated_at')
    .eq('founder_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deckError) {
    console.error('Deck lookup failed:', deckError);
    return NextResponse.json({ success: false, error: 'Could not load the deck.' }, { status: 500 });
  }
  if (!deck) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }

  if (deck.kind === 'link' && deck.link_url) {
    return NextResponse.json({ success: true, deck: toDeckSummary(deck), url: deck.link_url });
  }

  if (!deck.storage_path) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }

  const { data: signed, error: signError } = await serviceSupabase.storage
    .from(DECK_BUCKET)
    .createSignedUrl(deck.storage_path, DECK_SIGNED_URL_SECONDS, {
      download: deck.file_name || undefined,
    });
  if (signError || !signed?.signedUrl) {
    console.error('Deck signed URL failed:', signError);
    return NextResponse.json({ success: false, error: 'Could not open the deck.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deck: toDeckSummary(deck), url: signed.signedUrl });
}
