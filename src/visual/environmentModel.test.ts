import assert from 'node:assert/strict';
import test from 'node:test';
import {
  environmentDecorBudget,
  generateEnvironmentDecor,
} from './environmentModel.ts';

test('environment decoration generation is repeatable', () => {
  const a = generateEnvironmentDecor(3000, 3000, 180);
  const b = generateEnvironmentDecor(3000, 3000, 180);
  assert.deepEqual(a, b);
});

test('environment decoration changes when world dimensions change', () => {
  assert.notDeepEqual(
    generateEnvironmentDecor(3000, 3000, 20),
    generateEnvironmentDecor(3200, 3000, 20),
  );
});

test('environment budgets scale by visual quality', () => {
  assert.ok(environmentDecorBudget('low') < environmentDecorBudget('medium'));
  assert.ok(environmentDecorBudget('medium') < environmentDecorBudget('high'));
  assert.ok(environmentDecorBudget('high') < environmentDecorBudget('ultra'));
});
