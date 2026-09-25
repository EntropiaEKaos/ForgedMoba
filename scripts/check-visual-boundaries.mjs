import { readFileSync } from 'node:fs';

const forbidden = [
  /from ['"]\.\.\/game\//,
  /stepSimulation\s*\(/,
  /Math\.random\s*\(/,
];

const targets = process.argv.slice(2);
let failed = false;
for (const target of targets) {
  const source = readFileSync(target, 'utf8');
  for (const rule of forbidden) {
    if (rule.test(source)) {
      console.error('[visual-boundary] forbidden pattern ' + rule + ' in ' + target);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('[visual-boundary] OK');
