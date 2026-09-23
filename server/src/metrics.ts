type Labels = Record<string, string | number>;

function escapeLabel(value: string | number): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function labelKey(labels: Labels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + '=' + String(value))
    .join(',');
}

function renderLabels(labels: Labels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '';
  return '{' + entries.map(([key, value]) => key + '="' + escapeLabel(value) + '"').join(',') + '}';
}

interface MetricPoint {
  name: string;
  labels: Labels;
  value: number;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, MetricPoint>();

  inc(name: string, labels: Labels = {}, amount = 1): void {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) throw new Error('invalid metric name: ' + name);
    const key = name + '|' + labelKey(labels);
    const current = this.counters.get(key);
    if (current) {
      current.value += amount;
      return;
    }
    this.counters.set(key, { name, labels: { ...labels }, value: amount });
  }

  value(name: string, labels: Labels = {}): number {
    return this.counters.get(name + '|' + labelKey(labels))?.value ?? 0;
  }

  render(gauges: MetricPoint[] = []): string {
    const points = [...this.counters.values(), ...gauges]
      .sort((a, b) => a.name.localeCompare(b.name) || labelKey(a.labels).localeCompare(labelKey(b.labels)));
    return points.map((point) => point.name + renderLabels(point.labels) + ' ' + point.value).join('\n') + '\n';
  }
}

export type { MetricPoint };
