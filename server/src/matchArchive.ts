import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MatchReplayRecord } from './replay.ts';

export interface MatchArchiveStore {
  save(record: MatchReplayRecord): Promise<void>;
  read(matchId: string): Promise<MatchReplayRecord | null>;
}

export class MemoryMatchArchiveStore implements MatchArchiveStore {
  private readonly records = new Map<string, MatchReplayRecord>();

  async save(record: MatchReplayRecord): Promise<void> {
    this.records.set(record.matchId, structuredClone(record));
  }

  async read(matchId: string): Promise<MatchReplayRecord | null> {
    const record = this.records.get(matchId);
    return record ? structuredClone(record) : null;
  }
}

export class FileMatchArchiveStore implements MatchArchiveStore {
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  async save(record: MatchReplayRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const target = this.pathFor(record.matchId);
    const temp = target + '.' + process.pid + '.tmp';
    await writeFile(temp, JSON.stringify(record), 'utf8');
    await rename(temp, target);
  }

  async read(matchId: string): Promise<MatchReplayRecord | null> {
    try {
      const raw = await readFile(this.pathFor(matchId), 'utf8');
      return JSON.parse(raw) as MatchReplayRecord;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      throw error;
    }
  }

  private pathFor(matchId: string): string {
    const safe = matchId.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return path.join(this.directory, safe + '.json');
  }
}

export function createMatchArchiveStore(directory?: string): MatchArchiveStore {
  return directory?.trim()
    ? new FileMatchArchiveStore(path.resolve(directory))
    : new MemoryMatchArchiveStore();
}
