import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git', '.tmp-sim'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = await walk(path.join(root, 'src'));
for (const file of files) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const text = await readFile(file, 'utf8');
  const info = await stat(file);

  if (rel.startsWith('src/simulation/') && /Math\.random\s*\(/.test(text)) {
    failures.push(`${rel}: authoritative simulation must not use Math.random()`);
  }
  if (rel.startsWith('src/simulation/') && /(HTMLCanvasElement|CanvasRenderingContext2D|document\.|window\.|localStorage)/.test(text)) {
    failures.push(`${rel}: simulation core must remain headless and DOM-free`);
  }
  if (rel.startsWith('src/simulation/') && /from ['"]\.\.\/game\//.test(text)) {
    failures.push(`${rel}: simulation core must not depend on the legacy game engine`);
  }
  if (info.size > 350_000) {
    failures.push(`${rel}: file exceeds 350KB architecture ceiling`);
  }
}

if (failures.length) {
  console.error('Architecture checks failed:\n' + failures.map(x => ` - ${x}`).join('\n'));
  process.exit(1);
}
console.log('Architecture checks passed.');
