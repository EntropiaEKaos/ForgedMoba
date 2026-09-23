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
  assert.ok(result.ticksPerSecond > 0);
});
