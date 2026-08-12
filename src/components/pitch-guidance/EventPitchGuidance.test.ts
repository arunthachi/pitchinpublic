import assert from 'node:assert/strict';
import test from 'node:test';
import { pitchPlanMissingFields, type PitchBriefGroup } from './EventPitchGuidance';

const groups: PitchBriefGroup[] = [{
  id: 'plan', label: 'Pitch plan', fields: [
    { key: 'tagline', label: 'Tagline', value: '', required: true },
    { key: 'stage', label: 'Stage', value: '', required: false },
    { key: 'ask', label: 'Ask', value: '', required: true },
  ],
}];

test('pitch plan progress ignores optional stage and industry context', () => {
  assert.deepEqual(pitchPlanMissingFields(groups, { tagline: 'Clear promise', stage: '', ask: '  ' }).map((field) => field.key), ['ask']);
});

test('pitch plan is complete when every required response is present', () => {
  assert.equal(pitchPlanMissingFields(groups, { tagline: 'Clear promise', stage: '', ask: 'Book a pilot' }).length, 0);
});
