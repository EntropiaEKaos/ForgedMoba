export interface ContentManifest {
  version: string;
  hash: string;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Content payload contains a non-finite number.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(compareText)) {
      const entry = source[key];
      if (entry !== undefined) result[key] = canonicalize(entry);
    }
    return result;
  }
  throw new Error('Content payload must be JSON-serializable data.');
}

export function stableContentString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashContent(value: unknown): string {
  const input = stableContentString(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createContentManifest(version: string, payload: unknown): ContentManifest {
  if (!version.trim()) throw new Error('Content version must not be empty.');
  return { version: version.trim(), hash: hashContent(payload) };
}
