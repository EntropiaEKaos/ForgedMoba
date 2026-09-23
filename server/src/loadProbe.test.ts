import assert from 'node:assert/strict';
import test from 'node:test';
import { runFiveVFiveLoadProbe } from './loadProbe.ts';

test('5v5 load smoke advances concurrent authoritative matches with command pressure', () => {
  const result = runFiveVFiveLoadProbe({
    matches: 12,
    ticks: 180,
    commandEveryTicks: 15,
  });
  assert.equal(result.matches, 12);
  assert.equal(result.simulatedTicks, 2160);
  assert.equal(result.finalHashes.length, 12);
  assert.ok(result.finalHashes.every((hash) => /^[0-9a-f]{8}$/.test(hash)));
  assert.ok(result.commandsEnqueued >= 1200);
  assert.equal(result.snapshotsEmitted, 12 * Math.floor(180 / 3));
  assert.ok(result.ticksPerSecond > 0);
});

test('5v5 load probe is state-deterministic across repeated identical runs', () => {
  const options = {
    matches: 4,
    ticks: 120,
    commandEveryTicks: 15,
  };
  const first = runFiveVFiveLoadProbe(options);
  const second = runFiveVFiveLoadProbe(options);
  assert.deepEqual(first.finalHashes, second.finalHashes);
  assert.equal(first.commandsEnqueued, second.commandsEnqueued);
  assert.equal(first.snapshotsEmitted, second.snapshotsEmitted);
});
