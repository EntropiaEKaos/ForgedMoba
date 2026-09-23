import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

rmSync('.tmp-sim', { recursive: true, force: true });

const tscBin = process.platform === 'win32'
  ? 'node_modules/.bin/tsc.cmd'
  : 'node_modules/.bin/tsc';

const compile = spawnSync(tscBin, ['-p', 'tsconfig.sim-test.json'], {
  stdio: 'inherit',
  shell: false,
});

if (compile.status !== 0) process.exit(compile.status ?? 1);

const tests = spawnSync(process.execPath, ['--test', '.tmp-sim/tests/simulation/determinism.test.js'], {
  stdio: 'inherit',
  shell: false,
});

process.exit(tests.status ?? 1);
