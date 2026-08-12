import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');
const studioSource = readFileSync(new URL('../../../../../components/RecordingStudio.tsx', import.meta.url), 'utf8');

test('recording sessions accept and forward an exact published standard version', () => {
  assert.match(source, /guidelineVersionId: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(source, /requested_guideline_version_id: parsed\.data\.guidelineVersionId \|\| null/);
  assert.match(studioSource, /body: JSON\.stringify\(\{ guidelineVersionId: selectedGuidelineVersionId \|\| undefined \}\)/);
});

test('recording studio can retain the old version or restart with the current one', () => {
  assert.match(studioSource, /Keep recording with the plan you started/);
  assert.match(studioSource, /setSelectedGuidelineVersionId\(versionConflict\.currentId\)/);
});
