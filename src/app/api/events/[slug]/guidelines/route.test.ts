import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('guideline endpoints expose bounded current/draft data and revisioned writes', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /select\('\*'\)/);
  assert.match(source, /export async function PATCH/);
  assert.match(source, /save_event_pitch_guideline_draft/);
  assert.match(source, /publish_event_pitch_guideline_draft/);
  assert.match(source, /draft_changed/);
});
