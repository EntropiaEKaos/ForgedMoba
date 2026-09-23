export interface ReconnectLease {
  matchId: string;
  playerId: string;
  team: 0 | 1;
  disconnectedAt: number;
  expiresAt: number;
}

export class ReconnectGraceRegistry {
  readonly graceMs: number;
  private readonly leases = new Map<string, ReconnectLease>();

  constructor(graceMs = 30_000) {
    this.graceMs = Math.max(1_000, Math.trunc(graceMs));
  }

  markDisconnected(matchId: string, playerId: string, team: 0 | 1, now = Date.now()): ReconnectLease {
    const lease: ReconnectLease = {
      matchId,
      playerId,
      team,
      disconnectedAt: Math.trunc(now),
      expiresAt: Math.trunc(now) + this.graceMs,
    };
    this.leases.set(this.key(matchId, playerId), lease);
    return { ...lease };
  }

  markReconnected(matchId: string, playerId: string): boolean {
    return this.leases.delete(this.key(matchId, playerId));
  }

  consumeExpired(now = Date.now()): ReconnectLease[] {
    const expired = [...this.leases.values()]
      .filter((lease) => lease.expiresAt <= now)
      .sort((a, b) => a.expiresAt - b.expiresAt || a.playerId.localeCompare(b.playerId));
    for (const lease of expired) this.leases.delete(this.key(lease.matchId, lease.playerId));
    return expired.map((lease) => ({ ...lease }));
  }

  clearMatch(matchId: string): void {
    for (const [key, lease] of this.leases) {
      if (lease.matchId === matchId) this.leases.delete(key);
    }
  }

  get(matchId: string, playerId: string): ReconnectLease | null {
    const lease = this.leases.get(this.key(matchId, playerId));
    return lease ? { ...lease } : null;
  }

  forMatch(matchId: string): ReconnectLease[] {
    return [...this.leases.values()]
      .filter((lease) => lease.matchId === matchId)
      .sort((a, b) => a.expiresAt - b.expiresAt || a.playerId.localeCompare(b.playerId))
      .map((lease) => ({ ...lease }));
  }

  get size(): number {
    return this.leases.size;
  }

  private key(matchId: string, playerId: string): string {
    return matchId + ':' + playerId;
  }
}
