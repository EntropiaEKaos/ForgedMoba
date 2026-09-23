import { runFiveVFiveLoadProbe } from './loadProbe.ts';

function arg(name: string, fallback: number): number {
  const prefix = '--' + name + '=';
  const raw = process.argv.find((value) => value.startsWith(prefix));
  const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

const result = runFiveVFiveLoadProbe({
  matches: arg('matches', 50),
  ticks: arg('ticks', 900),
  commandEveryTicks: arg('command-every', 15),
});

console.log(JSON.stringify(result, null, 2));
const expectedSnapshots = result.matches * Math.floor(result.ticksPerMatch / 3);
if (
  result.finalHashes.length !== result.matches ||
  result.commandsEnqueued <= 0 ||
  result.snapshotsEmitted !== expectedSnapshots
) process.exitCode = 1;
