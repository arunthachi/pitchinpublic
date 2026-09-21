import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function readPublicFile(name: string) {
  return readFile(path.join(process.cwd(), 'public', name), 'utf8');
}

test('llms source map uses the canonical marketing and product origins intentionally', async () => {
  const content = await readPublicFile('llms.txt');
  assert.match(content, /https:\/\/www\.pitchinpublic\.io\/for-events/);
  assert.match(content, /https:\/\/www\.pitchinpublic\.io\/founders/);
  assert.match(content, /Product application: https:\/\/app\.pitchinpublic\.io\//);
  assert.doesNotMatch(content, /app\.pitchinpublic\.io\/leaderboard/);
});

test('full context states current capability and claim boundaries', async () => {
  const content = await readPublicFile('llms-full.txt');
  assert.match(content, /one to six minutes/);
  assert.match(content, /does not provide AI-generated coaching/);
  assert.match(content, /private to the event by default/);
  assert.match(content, /guarantees? crawling, indexing, ranking, citation/);
  assert.doesNotMatch(content, /Daily 60-second pitch practice/);
  assert.doesNotMatch(content, /price:\s*0|free plan|real-time reaction counts/i);
});

test('the product manifest remains installable without stale product claims', async () => {
  const manifest = JSON.parse(await readPublicFile('manifest.webmanifest')) as {
    name: string;
    description: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; sizes: string }>;
  };

  assert.equal(manifest.name, 'Pitch in Public');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.description, /Guided pitch preparation/);
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ['192x192', '512x512']);
  assert.doesNotMatch(JSON.stringify(manifest), /offline|real-time reaction|daily 60-second/i);
});
