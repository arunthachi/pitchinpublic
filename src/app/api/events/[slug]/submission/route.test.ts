import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('structured final submission uses one atomic RPC while retaining legacy path', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.match(source, /guidance_mode === 'structured_active'/);
  assert.match(source, /rpc\('submit_structured_event_final_take'/);
  assert.match(source, /from\('pitch_event_submissions'\)/, 'legacy path remains available');
});
