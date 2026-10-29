import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { Loop, Sound } from '@app/shared';
import loopReducer from './loopReducer';

const initialLoop: Loop = {
  drums: [],
  bass: [],
  synth_low: [],
  synth_high: [],
};

const sound: Sound = {
  id: 'sound-1',
  note: 'C3',
  start: 0,
  duration: 2,
};

test('adds and removes sounds without mutating the previous loop', () => {
  const added = loopReducer(initialLoop, { type: 'add', track: 'drums', sound });

  assert.deepEqual(added.drums, [sound]);
  assert.deepEqual(initialLoop.drums, []);

  const removed = loopReducer(added, {
    type: 'remove',
    track: 'drums',
    soundId: sound.id,
  });

  assert.deepEqual(removed.drums, []);
  assert.deepEqual(added.drums, [sound]);
});

test('ignores duplicate sound IDs and replaces snapshots', () => {
  const added = loopReducer(initialLoop, { type: 'add', track: 'bass', sound });
  const duplicate = loopReducer(added, { type: 'add', track: 'bass', sound });

  assert.equal(duplicate, added);

  const snapshot: Loop = { ...initialLoop, synth_low: [sound] };
  assert.equal(loopReducer(duplicate, { type: 'replace', state: snapshot }), snapshot);
});
