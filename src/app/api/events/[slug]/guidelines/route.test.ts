import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const editorSource = readFileSync(new URL('../../../../../components/event-guidance/PitchGuidelinesEditor.tsx', import.meta.url), 'utf8');

test('guideline endpoints expose bounded current/draft data and revisioned writes', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /select\('\*'\)/);
  assert.match(source, /export async function PATCH/);
  assert.match(source, /save_event_pitch_guideline_draft/);
  assert.match(source, /publish_event_pitch_guideline_draft/);
  assert.match(source, /draft_changed/);
  assert.match(source, /guideline: data, draft: draft \|\| null/);
});

test('publishing returns the incremented draft revision needed for the next version', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.match(source, /event_pitch_guideline_drafts/);
  assert.match(source, /guideline: data, draft: draft \|\| null/);
  assert.match(editorSource, /normalizeStandard\(data\.draft\) \|\| nextPublished \|\| draft/);
});
