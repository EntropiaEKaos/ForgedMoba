export interface NetworkMetricsSnapshot {
  rttMs: number | null;
  jitterMs: number;
  snapshotIntervalMs: number | null;
  skippedSnapshotWindows: number;
  correctionDistance: number;
  samples: number;
}

export class NetworkTelemetry {
  private rttSamples: number[] = [];
  private snapshotIntervals: number[] = [];
  private lastSnapshotAt: number | null = null;
  private lastServerTick: number | null = null;
  private skipped = 0;
  private correction = 0;
  private readonly maxSamples: number;

  constructor(maxSamples = 30) {
    this.maxSamples = Math.max(5, Math.trunc(maxSamples));
  }

  reset(): void {
    this.rttSamples = [];
    this.snapshotIntervals = [];
    this.lastSnapshotAt = null;
    this.lastServerTick = null;
    this.skipped = 0;
    this.correction = 0;
  }

  recordRtt(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.rttSamples.push(ms);
    if (this.rttSamples.length > this.maxSamples) this.rttSamples.shift();
  }

  recordSnapshot(arrivalMs: number, serverTick: number, expectedEveryTicks = 3): void {
    if (!Number.isFinite(arrivalMs) || !Number.isFinite(serverTick)) return;
    if (this.lastSnapshotAt !== null) {
      this.snapshotIntervals.push(Math.max(0, arrivalMs - this.lastSnapshotAt));
      if (this.snapshotIntervals.length > this.maxSamples) this.snapshotIntervals.shift();
    }
    if (this.lastServerTick !== null) {
      const gap = Math.max(0, Math.trunc(serverTick - this.lastServerTick));
      if (gap > expectedEveryTicks) this.skipped += Math.max(0, Math.floor(gap / expectedEveryTicks) - 1);
    }
    this.lastSnapshotAt = arrivalMs;
    this.lastServerTick = Math.trunc(serverTick);
  }

  recordCorrection(distance: number): void {
    if (Number.isFinite(distance) && distance >= 0) this.correction = distance;
  }

  snapshot(): NetworkMetricsSnapshot {
    const average = (values: readonly number[]) =>
      values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
    const rtt = average(this.rttSamples);
    const interval = average(this.snapshotIntervals);
    const jitter = this.rttSamples.length < 2 || rtt === null
      ? 0
      : this.rttSamples.reduce((sum, value) => sum + Math.abs(value - rtt), 0) / this.rttSamples.length;

    return {
      rttMs: rtt,
      jitterMs: jitter,
      snapshotIntervalMs: interval,
      skippedSnapshotWindows: this.skipped,
      correctionDistance: this.correction,
      samples: this.rttSamples.length,
    };
  }
}
