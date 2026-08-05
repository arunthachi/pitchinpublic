import assert from 'node:assert/strict';
import test from 'node:test';
import * as videoRoute from './route';

test('does not expose a destructive video DELETE handler', () => {
  assert.equal(
    Reflect.has(videoRoute, 'DELETE'),
    false,
    'DELETE must stay disabled until videos have authenticated ownership enforcement'
  );
});
