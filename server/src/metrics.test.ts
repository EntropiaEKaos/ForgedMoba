import assert from 'node:assert/strict';
import test from 'node:test';
import { MetricsRegistry } from './metrics.ts';

test('metrics registry accumulates counters by stable labels', () => {
  const metrics = new MetricsRegistry();
  metrics.inc('forged_commands_total', { result: 'accepted', mode: 'ranked5v5' });
  metrics.inc('forged_commands_total', { mode: 'ranked5v5', result: 'accepted' }, 2);
  assert.equal(metrics.value('forged_commands_total', { result: 'accepted', mode: 'ranked5v5' }), 3);
});

test('prometheus rendering is stable and includes gauges', () => {
  const metrics = new MetricsRegistry();
  metrics.inc('forged_matches_total', { mode: 'duel1v1' }, 2);
  const text = metrics.render([
    { name: 'forged_active_matches', labels: {}, value: 4 },
  ]);
  assert.equal(
    text,
    'forged_active_matches 4\nforged_matches_total{mode="duel1v1"} 2\n',
  );
});
