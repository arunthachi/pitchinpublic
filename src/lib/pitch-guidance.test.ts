import assert from 'node:assert/strict';
import test from 'node:test';
import { founderBriefSchema, publishGuidelinesSchema } from './pitch-guidance';

const criteria = ['clarity', 'problem', 'solution', 'ask'].map((key) => ({ key, label: key, guidance: '' }));

test('accepts a four-to-six criterion immutable guideline payload', () => {
  const result = publishGuidelinesSchema.safeParse({ title: 'Demo day standard', criteria });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.disclosureMode, 'role_only');
});

test('rejects duplicate criterion keys and undersized rubrics', () => {
  assert.equal(publishGuidelinesSchema.safeParse({ title: 'Standard', criteria: criteria.slice(0, 3) }).success, false);
  assert.equal(publishGuidelinesSchema.safeParse({ title: 'Standard', criteria: [...criteria, criteria[0]] }).success, false);
});

test('enforces founder brief limits used by the database contract', () => {
  assert.equal(founderBriefSchema.safeParse({ tagline: 'x'.repeat(60) }).success, true);
  assert.equal(founderBriefSchema.safeParse({ tagline: 'x'.repeat(61) }).success, false);
});
