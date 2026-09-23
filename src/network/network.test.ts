import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthoritativeSnapshot } from '../shared/protocol.ts';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import type { SimulationState } from '../simulation/types.ts';
import { SnapshotInterpolationBuffer } from './interpolation.ts';
import { ClientPrediction } from './prediction.ts';
import { NetworkTelemetry } from './telemetry.ts';

function snapshot(state: SimulationState, ack = -1): AuthoritativeSnapshot<SimulationState> {
  return {
    matchId: 'match-network-test',
    contentVersion: state.contentVersion,
    serverTick: state.tick,
    ackSeqByPlayer: { blue: ack, red: -1 },
    stateHash: 'deadbeef',
    state: structuredClone(state),
  };
}

function baseState(): SimulationState {
  return createSimulation({
    seed: 123,
    contentVersion: 'network-test',
    players: [
      { playerId: 'blue', team: 0, x: 1000, y: 1000, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 1400, y: 1000, heroId: 'luxana' },
    ],
  });
}

test('prediction replays unacknowledged local movement immediately', () => {
  const state = baseState();
  const prediction = new ClientPrediction('blue');
  prediction.acceptSnapshot(snapshot(state));
  prediction.record({ type: 'move', playerId: 'blue', seq: 1, tick: 0, x: 1200, y: 1000 });

  const predicted = prediction.predictThrough(0);
  assert.ok(predicted);
  assert.ok(predicted.entities['1'].x > 1000);
  assert.equal(prediction.pendingCount, 1);
});

test('reconciliation drops acknowledged commands and converges to authority', () => {
  const clientBase = baseState();
  const prediction = new ClientPrediction('blue');
  prediction.acceptSnapshot(snapshot(clientBase));
  const command = { type: 'move', playerId: 'blue', seq: 1, tick: 0, x: 1200, y: 1000 } as const;
  prediction.record(command);
  prediction.predictThrough(0);

  const server = baseState();
  stepSimulation(server, [command]);
  const result = prediction.acceptSnapshot(snapshot(server, 1), server.tick - 1);

  assert.equal(result.droppedCommands, 1);
  assert.equal(result.pendingCommands, 0);
  assert.equal(prediction.pendingCount, 0);
  const reconciled = prediction.predictThrough(server.tick - 1);
  assert.equal(reconciled?.entities['1'].x, server.entities['1'].x);
});

test('interpolation samples remote positions between authoritative snapshots', () => {
  const a = baseState();
  const b = structuredClone(a);
  b.tick = 3;
  b.entities['2'].x = 1412;

  const buffer = new SnapshotInterpolationBuffer();
  buffer.push(snapshot(a));
  buffer.push(snapshot(b));

  const frame = buffer.sample(1.5);
  assert.ok(frame);
  const red = frame.entities.find((entity) => entity.id === 2);
  assert.ok(red);
  assert.equal(red.x, 1406);
  assert.equal(frame.alpha, 0.5);
});

test('telemetry tracks RTT jitter snapshot gaps and correction distance', () => {
  const telemetry = new NetworkTelemetry();
  telemetry.recordRtt(40);
  telemetry.recordRtt(60);
  telemetry.recordSnapshot(1000, 3);
  telemetry.recordSnapshot(1100, 6);
  telemetry.recordSnapshot(1300, 12);
  telemetry.recordCorrection(7.5);

  const metrics = telemetry.snapshot();
  assert.equal(metrics.rttMs, 50);
  assert.equal(metrics.jitterMs, 10);
  assert.equal(metrics.snapshotIntervalMs, 150);
  assert.equal(metrics.skippedSnapshotWindows, 1);
  assert.equal(metrics.correctionDistance, 7.5);
});
