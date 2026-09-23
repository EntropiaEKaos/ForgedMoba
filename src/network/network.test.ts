import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthoritativeSnapshot } from '../shared/protocol.ts';
import { createSimulation, stepSimulation } from '../simulation/core.ts';
import { createClientViewState } from '../simulation/visibility.ts';
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


test('prediction applies published item buys and later reconciles the server acknowledgement', () => {
  const state = baseState();
  const prediction = new ClientPrediction('blue');
  prediction.acceptSnapshot(snapshot(state));
  const command = { type: 'buy', playerId: 'blue', seq: 1, tick: 0, itemId: 'longsword' } as const;
  prediction.record(command);

  const predicted = prediction.predictThrough(0);
  assert.deepEqual(predicted?.entities['1'].inventory, ['longsword']);

  const server = baseState();
  stepSimulation(server, [command]);
  const result = prediction.acceptSnapshot(snapshot(server, 1), server.tick - 1);
  assert.equal(result.pendingCommands, 0);
  assert.deepEqual(prediction.predictThrough(server.tick - 1)?.entities['1'].inventory, ['longsword']);
});


test('prediction replays ward placement and reconciles the authoritative ward entity', () => {
  const state = baseState();
  const prediction = new ClientPrediction('blue');
  prediction.acceptSnapshot(snapshot(state));
  const command = {
    type: 'place-ward',
    playerId: 'blue',
    seq: 1,
    tick: 0,
    x: 1450,
    y: 1000,
  } as const;
  prediction.record(command);

  const predicted = prediction.predictThrough(0);
  assert.equal(
    Object.values(predicted?.entities ?? {}).filter((entity) => entity.kind === 'ward').length,
    1,
  );

  const server = baseState();
  stepSimulation(server, [command]);
  const result = prediction.acceptSnapshot(snapshot(server, 1), server.tick - 1);
  assert.equal(result.pendingCommands, 0);
  const reconciled = prediction.predictThrough(server.tick - 1);
  assert.equal(
    Object.values(reconciled?.entities ?? {}).filter((entity) => entity.kind === 'ward').length,
    1,
  );
});


test('owned-state prediction remains responsive on a fog-redacted snapshot', () => {
  const full = createSimulation({
    seed: 456,
    contentVersion: 'network-fog-test',
    players: [
      { playerId: 'blue', team: 0, x: 700, y: 1000, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 2300, y: 1000, heroId: 'luxana' },
    ],
  });
  const view = createClientViewState(full, 'blue');
  assert.equal(Object.values(view.entities).some((entity) => entity.ownerPlayerId === 'red'), false);
  assert.equal(view.rngState, 0);

  const prediction = new ClientPrediction('blue');
  prediction.acceptSnapshot({
    matchId: 'fog-match',
    contentVersion: view.contentVersion,
    serverTick: view.tick,
    ackSeqByPlayer: { blue: -1 },
    stateHash: 'viewhash',
    state: view,
  });

  prediction.record({
    type: 'move',
    playerId: 'blue',
    seq: 1,
    tick: 0,
    x: 900,
    y: 1000,
  });
  const predicted = prediction.predictThrough(0);
  const local = Object.values(predicted?.entities ?? {}).find((entity) => entity.ownerPlayerId === 'blue');
  assert.ok(local);
  assert.ok(local.x > 700);
  assert.equal(Object.values(predicted?.entities ?? {}).some((entity) => entity.ownerPlayerId === 'red'), false);
});

test('ward prediction on a redacted view does not require hidden entity IDs or RNG', () => {
  const full = createSimulation({
    seed: 789,
    contentVersion: 'network-fog-ward',
    players: [
      { playerId: 'blue', team: 0, x: 700, y: 1000, heroId: 'gareth' },
      { playerId: 'red', team: 1, x: 2300, y: 1000, heroId: 'luxana' },
    ],
  });
  const view = createClientViewState(full, 'blue');
  const prediction = new ClientPrediction('blue');
  prediction.acceptSnapshot({
    matchId: 'fog-ward-match',
    contentVersion: view.contentVersion,
    serverTick: view.tick,
    ackSeqByPlayer: { blue: -1 },
    stateHash: 'viewhash',
    state: view,
  });
  prediction.record({
    type: 'place-ward',
    playerId: 'blue',
    seq: 1,
    tick: 0,
    x: 1000,
    y: 1000,
  });

  const predicted = prediction.predictThrough(0);
  const ward = Object.values(predicted?.entities ?? {}).find((entity) => entity.kind === 'ward');
  assert.ok(ward);
  assert.ok(ward.id >= 1_000_000_000);
});
