import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { firstGuidanceIssue, publishGuidelinesSchema, saveGuidelineDraftSchema } from '@/lib/pitch-guidance';

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
}

async function eventIdForSlug(supabase: ReturnType<typeof client>, slug: string) {
  const { data } = await supabase.from('pitch_events').select('id').eq('slug', slug).maybeSingle();
  return data?.id as string | undefined;
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const versionId = request.nextUrl.searchParams.get('versionId');
  const [{ data: published, error }, { data: draft }] = await Promise.all([
    versionId
      ? supabase.from('event_pitch_guideline_versions').select('id,event_id,version,title,instructions,criteria,created_at').eq('event_id', eventId).eq('id', versionId).maybeSingle()
      : supabase.from('event_pitch_guideline_versions').select('id,event_id,version,title,instructions,criteria,created_at').eq('event_id', eventId).order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('event_pitch_guideline_drafts').select('event_id,revision,title,instructions,criteria,disclosure_mode,updated_at').eq('event_id', eventId).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ success: false, error: 'Could not load pitch guidelines.' }, { status: 500 });
  return NextResponse.json({ success: true, published: published || null, guideline: published || null, guidelines: published ? [published] : [], draft: draft || null });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params; const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const parsed = saveGuidelineDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstGuidanceIssue(parsed.error) }, { status: 400 });
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const value = parsed.data;
  const { data, error } = await supabase.rpc('save_event_pitch_guideline_draft', { target_event_id: eventId, expected_revision: value.revision, draft_title: value.title, draft_instructions: value.instructions, draft_criteria: value.criteria, disclosure: value.disclosureMode });
  if (error) return NextResponse.json({ success: false, code: error.message.includes('draft_changed') ? 'draft_changed' : undefined, error: error.message.includes('draft_changed') ? 'The pitch standard changed. Reload and reapply your edits.' : 'Could not save pitch standard draft.' }, { status: error.message.includes('draft_changed') ? 409 : 403 });
  return NextResponse.json({ success: true, draft: data });
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  const parsed = publishGuidelinesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstGuidanceIssue(parsed.error) }, { status: 400 });
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  const { data, error } = await supabase.rpc('publish_event_pitch_guideline_draft', {
    target_event_id: eventId, expected_revision: parsed.data.revision, publication_request_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const forbidden = error.message.includes('manager access');
    const changed = error.message.includes('draft_changed');
    return NextResponse.json({ success: false, code: changed ? 'draft_changed' : undefined, error: forbidden ? 'Event manager access required' : changed ? 'The pitch standard changed. Reload before publishing.' : 'Could not publish pitch guidelines.' }, { status: forbidden ? 403 : changed ? 409 : 500 });
  }
  const { data: draft } = await supabase
    .from('event_pitch_guideline_drafts')
    .select('event_id,revision,title,instructions,criteria,disclosure_mode,updated_at')
    .eq('event_id', eventId)
    .maybeSingle();
  return NextResponse.json({ success: true, guideline: data, draft: draft || null }, { status: 201 });
}
