import { performance } from 'node:perf_hooks';
import { CURRENT_AUTHORITATIVE_CONTENT, type AuthoritativeHeroId } from '../../src/shared/authoritativeContent.ts';
import { hashSimulationState } from '../../src/simulation/index.ts';
import { MatchRunner, stableSeedFromMatchId } from './matchRunner.ts';

export interface FiveVFiveLoadProbeOptions {
  matches?: number;
  ticks?: number;
  commandEveryTicks?: number;
}

export interface FiveVFiveLoadProbeResult {
  matches: number;
  ticksPerMatch: number;
  simulatedTicks: number;
  commandsEnqueued: number;
  elapsedMs: number;
  ticksPerSecond: number;
  finalHashes: string[];
}

function playersFor(matchIndex: number) {
  return Array.from({ length: 10 }, (_, index) => ({
    playerId: 'load-' + matchIndex + '-p' + index,
    team: (index < 5 ? 0 : 1) as 0 | 1,
    slot: index % 5,
    heroId: (index % 2 === 0 ? 'gareth' : 'luxana') as AuthoritativeHeroId,
  }));
}

export function runFiveVFiveLoadProbe(
  options: FiveVFiveLoadProbeOptions = {},
): FiveVFiveLoadProbeResult {
  const matches = Math.max(1, Math.trunc(options.matches ?? 24));
  const ticks = Math.max(1, Math.trunc(options.ticks ?? 600));
  const commandEveryTicks = Math.max(1, Math.trunc(options.commandEveryTicks ?? 15));

  const runners = Array.from({ length: matches }, (_, index) => {
    const matchId = 'load-probe-' + index;
    return new MatchRunner({
      matchId,
      contentVersion: CURRENT_AUTHORITATIVE_CONTENT.contentVersion,
      content: CURRENT_AUTHORITATIVE_CONTENT,
      seed: stableSeedFromMatchId(matchId),
      snapshotEveryTicks: 10_000_000,
      players: playersFor(index),
    });
  });

  const sequences = Array.from({ length: matches }, () => Array.from({ length: 10 }, () => 0));
  let commandsEnqueued = 0;
  const started = performance.now();

  for (let tick = 0; tick < ticks; tick += 1) {
    for (let matchIndex = 0; matchIndex < runners.length; matchIndex += 1) {
      const runner = runners[matchIndex];
      if (tick % commandEveryTicks === 0) {
        for (let playerIndex = 0; playerIndex < 10; playerIndex += 1) {
          const player = playersFor(matchIndex)[playerIndex];
          const seq = ++sequences[matchIndex][playerIndex];
          const direction = player.team === 0 ? 1 : -1;
          const result = runner.enqueue(player.playerId, {
            type: 'move',
            playerId: player.playerId,
            seq,
            tick: runner.state.tick,
            x: 1500 + direction * ((playerIndex % 5) * 25),
            y: 1320 + (playerIndex % 5) * 90,
          });
          if (result.ok) commandsEnqueued += 1;
        }
      }
      runner.advanceOneTick();
    }
  }

  const elapsedMs = Math.max(0.001, performance.now() - started);
  const simulatedTicks = matches * ticks;
  return {
    matches,
    ticksPerMatch: ticks,
    simulatedTicks,
    commandsEnqueued,
    elapsedMs,
    ticksPerSecond: simulatedTicks / (elapsedMs / 1000),
    finalHashes: runners.map((runner) => hashSimulationState(runner.state)),
  };
}
