import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';
import { DECK_BUCKET, buildDeckStoragePath, validateDeckFile } from '@/lib/pitch-deck';

/**
 * POST /api/startup/deck/upload-url
 * Issue a signed direct-upload URL for the caller's startup deck, mirroring
 * the Cloudflare direct-upload pattern so the file body never passes through
 * a Vercel route. The client uploads with uploadToSignedUrl, then confirms
 * via POST /api/startup/deck.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const result = await rateLimit({
    key: `deck-upload:${ip}`,
    limit: RATE_LIMITS.UPLOAD.limit,
    window: RATE_LIMITS.UPLOAD.window,
  });
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429, headers: formatRateLimitHeaders(result) }
    );
  }

  const supabase = createRequestSupabase(request);
  const serviceSupabase = createServiceSupabase();
  if (!supabase || !serviceSupabase) {
    return NextResponse.json(
      { success: false, error: 'Deck uploads are not configured in this environment.' },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!(await isUserAllowedForPilot(user))) {
    return NextResponse.json(
      { success: false, error: INVITE_ONLY_MESSAGE, code: 'invite_required' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Send the deck file details.' }, { status: 400 });
  }

  const { fileName, fileSize, mimeType } = (body || {}) as Record<string, unknown>;
  const validation = validateDeckFile({ fileName, fileSize, mimeType });
  if (!validation.ok) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
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
    console.error('Deck upload company lookup failed:', companyError);
    return NextResponse.json({ success: false, error: 'Could not load your startup.' }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json(
      { success: false, error: 'Set up your startup profile before adding a deck.' },
      { status: 409 }
    );
  }

  const storagePath = buildDeckStoragePath(company.id, validation.extension, randomBytes(4).toString('hex'));
  const { data: signed, error: signError } = await serviceSupabase.storage
    .from(DECK_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    console.error('Deck signed upload URL failed:', signError);
    return NextResponse.json({ success: false, error: 'Could not start the deck upload.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      storagePath,
      token: signed.token,
      bucket: DECK_BUCKET,
    },
    { headers: formatRateLimitHeaders(result) }
  );
}
