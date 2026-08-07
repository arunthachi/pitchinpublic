import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';
import {
  DECK_BUCKET,
  deckConfirmSchema,
  isDeckStoragePathForCompany,
  toDeckSummary,
  validateDeckFile,
  validateDeckLink,
} from '@/lib/pitch-deck';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/ratelimit';

type OwnerContext = {
  user: User;
  serviceSupabase: SupabaseClient;
  companyId: string;
};

async function requireOwnerContext(
  request: NextRequest
): Promise<{ ok: true; context: OwnerContext } | { ok: false; response: NextResponse }> {
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

async function removeStoredObject(serviceSupabase: SupabaseClient, storagePath?: string | null) {
  if (!storagePath) return;
  const { error } = await serviceSupabase.storage.from(DECK_BUCKET).remove([storagePath]);
  if (error) console.error('Deck object cleanup failed:', storagePath, error);
}

/** GET /api/startup/deck — the caller's own deck summary. */
export async function GET(request: NextRequest) {
  const owner = await requireOwnerContext(request);
  if (!owner.ok) return owner.response;
  const { serviceSupabase, companyId } = owner.context;

  const { data: deck, error } = await serviceSupabase
    .from('startup_decks')
    .select('kind, file_name, link_url, updated_at')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('Deck lookup failed:', error);
    return NextResponse.json({ success: false, error: 'Could not load your deck.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deck: deck ? toDeckSummary(deck) : null });
}

/**
 * POST /api/startup/deck — commit a deck: confirm a completed direct upload
 * (server verifies the object actually exists) or set an https link. Replaces
 * any previous deck and cleans up the superseded stored object.
 */
export async function POST(request: NextRequest) {
  const owner = await requireOwnerContext(request);
  if (!owner.ok) return owner.response;
  const { user, serviceSupabase, companyId } = owner.context;

  const userLimit = await rateLimit({
    key: `deck-confirm:${user.id}`,
    limit: RATE_LIMITS.UPLOAD.limit,
    window: RATE_LIMITS.UPLOAD.window,
  });
  if (!userLimit.success) {
    return NextResponse.json(
      { success: false, error: 'Too many deck changes. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Send the deck details.' }, { status: 400 });
  }

  const parsed = deckConfirmSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues.find(Boolean);
    return NextResponse.json(
      { success: false, error: issue?.message || 'Invalid deck details.' },
      { status: 400 }
    );
  }

  const { data: previous } = await serviceSupabase
    .from('startup_decks')
    .select('storage_path')
    .eq('company_id', companyId)
    .maybeSingle();

  let row: Record<string, unknown>;
  if (parsed.data.kind === 'file') {
    if (!isDeckStoragePathForCompany(parsed.data.storagePath, companyId)) {
      return NextResponse.json({ success: false, error: 'Invalid deck upload reference.' }, { status: 400 });
    }

    // Re-validate the display name at confirm time: it feeds the signed URL's
    // Content-Disposition, so it must be a real deck filename whose extension
    // matches the stored object — no "deck.pdf.exe" downloads, no query-string
    // metacharacters reaching storage-js's unencoded download parameter.
    const nameValidation = validateDeckFile({
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      mimeType: '',
    });
    const storedExtension = parsed.data.storagePath.split('.').pop();
    if (!nameValidation.ok || nameValidation.extension !== storedExtension) {
      return NextResponse.json(
        { success: false, error: 'The deck file name must end in .pdf, .ppt, or .pptx and match the uploaded file.' },
        { status: 400 }
      );
    }

    // The signed upload URL was issued server-side, but confirm the client
    // actually completed the upload before pointing the deck at the object.
    const [folder, objectName] = [companyId, parsed.data.storagePath.slice(companyId.length + 1)];
    const { data: objects, error: listError } = await serviceSupabase.storage
      .from(DECK_BUCKET)
      .list(folder, { search: objectName, limit: 1 });
    if (listError || !objects?.some((object) => object.name === objectName)) {
      return NextResponse.json(
        { success: false, error: 'The deck upload did not complete. Try again.' },
        { status: 409 }
      );
    }

    row = {
      company_id: companyId,
      founder_id: user.id,
      kind: 'file',
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      file_size_bytes: parsed.data.fileSize,
      link_url: null,
      updated_at: new Date().toISOString(),
    };
  } else {
    const link = validateDeckLink(parsed.data.url);
    if (!link.ok) {
      return NextResponse.json({ success: false, error: link.error }, { status: 400 });
    }
    row = {
      company_id: companyId,
      founder_id: user.id,
      kind: 'link',
      link_url: link.url,
      storage_path: null,
      file_name: null,
      file_size_bytes: null,
      updated_at: new Date().toISOString(),
    };
  }

  const { data: saved, error: saveError } = await serviceSupabase
    .from('startup_decks')
    .upsert(row, { onConflict: 'company_id' })
    .select('kind, file_name, link_url, updated_at')
    .single();

  if (saveError || !saved) {
    console.error('Deck save failed:', saveError);
    return NextResponse.json({ success: false, error: 'Could not save your deck.' }, { status: 500 });
  }

  if (previous?.storage_path && previous.storage_path !== row.storage_path) {
    await removeStoredObject(serviceSupabase, previous.storage_path);
  }

  return NextResponse.json({ success: true, deck: toDeckSummary(saved) });
}

/** DELETE /api/startup/deck — remove the deck and its stored object. */
export async function DELETE(request: NextRequest) {
  const owner = await requireOwnerContext(request);
  if (!owner.ok) return owner.response;
  const { serviceSupabase, companyId } = owner.context;

  const { data: previous, error: lookupError } = await serviceSupabase
    .from('startup_decks')
    .select('storage_path')
    .eq('company_id', companyId)
    .maybeSingle();

  if (lookupError) {
    console.error('Deck delete lookup failed:', lookupError);
    return NextResponse.json({ success: false, error: 'Could not remove your deck.' }, { status: 500 });
  }

  const { error: deleteError } = await serviceSupabase
    .from('startup_decks')
    .delete()
    .eq('company_id', companyId);

  if (deleteError) {
    console.error('Deck delete failed:', deleteError);
    return NextResponse.json({ success: false, error: 'Could not remove your deck.' }, { status: 500 });
  }

  await removeStoredObject(serviceSupabase, previous?.storage_path);

  return NextResponse.json({ success: true, deck: null });
}
