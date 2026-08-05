import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicPitchId, isPublicPitchId, pitchPath } from './public-routes';

test('accepts only production public pitch identifiers', () => {
  const id = createPublicPitchId();
  assert.equal(isPublicPitchId(id), true);
  assert.equal(isPublicPitchId('p_123456789abc'), true);
  assert.equal(isPublicPitchId('p_public123'), false);
  assert.equal(isPublicPitchId('p_1234'), false);
  assert.equal(isPublicPitchId('P_123456789ABC'), false);
});

test('builds a stable encoded pitch path', () => {
  assert.equal(pitchPath('p_123456789abc'), '/pitch/p_123456789abc');
});
