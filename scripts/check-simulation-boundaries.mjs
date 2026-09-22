import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve('src/simulation');
const forbidden = [
  ['Math.random', /Math\.random\s*\(/],
  ['DOM window', /\bwindow\b/],
  ['DOM document', /\bdocument\b/],
  ['localStorage', /\blocalStorage\b/],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['Canvas API', /\b(?:CanvasRenderingContext2D|HTMLCanvasElement)\b/],
  ['WebAudio', /\b(?:AudioContext|webkitAudioContext)\b/],
  ['network fetch', /\bfetch\s*\(/],
  ['WebSocket', /\bWebSocket\b/],
  ['legacy game import', /from\s+['"]\.\.\/game\//],
  ['React import', /from\s+['"]react(?:\/[^'"]*)?['"]/],
];

const entries = await readdir(root, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
  .map((entry) => path.join(root, entry.name));

const violations = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(codeOnly)) violations.push(path.relative(process.cwd(), file) + ': ' + label);
  }
}

if (violations.length > 0) {
  console.error('Simulation boundary violations:');
  for (const violation of violations) console.error(' - ' + violation);
  process.exit(1);
}

console.log('Simulation boundary check passed (' + files.length + ' production files).');
