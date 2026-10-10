/**
 * Prometheus Metrics
 *
 * Application metrics for monitoring and alerting.
 */

// Metric types
interface Counter {
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface Gauge {
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface Histogram {
  name: string;
  help: string;
  labels: string[];
  buckets: number[];
  values: Map<string, { count: number; sum: number; buckets: number[] }>;
}

// Metrics registry
const counters = new Map<string, Counter>();
const gauges = new Map<string, Gauge>();
const histograms = new Map<string, Histogram>();

// Default histogram buckets (latency in ms)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Create or get a counter metric
 */
function counter(
  name: string,
  help: string,
  labels: string[] = [],
): {
  inc: (labelValues?: Record<string, string>, value?: number) => void;
} {
  if (!counters.has(name)) {
    counters.set(name, { name, help, labels, values: new Map() });
  }

  return {
    inc: (labelValues = {}, value = 1) => {
      const counter = counters.get(name)!;
      const key = labelsToKey(labelValues, counter.labels);
      const current = counter.values.get(key) || 0;
      counter.values.set(key, current + value);
    },
  };
}

/**
 * Create or get a gauge metric
 */
function gauge(
  name: string,
  help: string,
  labels: string[] = [],
): {
  set: (value: number, labelValues?: Record<string, string>) => void;
  inc: (labelValues?: Record<string, string>, value?: number) => void;
  dec: (labelValues?: Record<string, string>, value?: number) => void;
} {
  if (!gauges.has(name)) {
    gauges.set(name, { name, help, labels, values: new Map() });
  }

  return {
    set: (value: number, labelValues = {}) => {
      const gauge = gauges.get(name)!;
      const key = labelsToKey(labelValues, gauge.labels);
      gauge.values.set(key, value);
    },
    inc: (labelValues = {}, value = 1) => {
      const gauge = gauges.get(name)!;
      const key = labelsToKey(labelValues, gauge.labels);
      const current = gauge.values.get(key) || 0;
      gauge.values.set(key, current + value);
    },
    dec: (labelValues = {}, value = 1) => {
      const gauge = gauges.get(name)!;
      const key = labelsToKey(labelValues, gauge.labels);
      const current = gauge.values.get(key) || 0;
      gauge.values.set(key, current - value);
    },
  };
}

/**
 * Create or get a histogram metric
 */
function histogram(
  name: string,
  help: string,
  labels: string[] = [],
  buckets: number[] = DEFAULT_BUCKETS,
): {
  observe: (value: number, labelValues?: Record<string, string>) => void;
  startTimer: (labelValues?: Record<string, string>) => () => void;
} {
  if (!histograms.has(name)) {
    histograms.set(name, {
      name,
      help,
      labels,
      buckets: [...buckets].sort((a, b) => a - b),
      values: new Map(),
    });
  }

  return {
    observe: (value: number, labelValues = {}) => {
      const hist = histograms.get(name)!;
      const key = labelsToKey(labelValues, hist.labels);

      if (!hist.values.has(key)) {
        hist.values.set(key, {
          count: 0,
          sum: 0,
          buckets: hist.buckets.map(() => 0),
        });
      }

      const data = hist.values.get(key)!;
      data.count++;
      data.sum += value;

      for (let i = 0; i < hist.buckets.length; i++) {
        if (value <= hist.buckets[i]) {
          data.buckets[i]++;
        }
      }
    },
    startTimer: (labelValues = {}) => {
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        histogram(name, help, labels, buckets).observe(duration, labelValues);
      };
    },
  };
}

/**
 * Convert label values to a unique key
 */
function labelsToKey(
  values: Record<string, string>,
  labelNames: string[],
): string {
  if (labelNames.length === 0) return "";
  return labelNames.map((name) => `${name}="${values[name] || ""}"`).join(",");
}

/**
 * Export metrics in Prometheus format
 */
export function exportMetrics(): string {
  const lines: string[] = [];

  // Export counters
  for (const counter of counters.values()) {
    lines.push(`# HELP ${counter.name} ${counter.help}`);
    lines.push(`# TYPE ${counter.name} counter`);

    if (counter.values.size === 0) {
      lines.push(`${counter.name} 0`);
    } else {
      for (const [key, value] of counter.values) {
        const labels = key ? `{${key}}` : "";
        lines.push(`${counter.name}${labels} ${value}`);
      }
    }
    lines.push("");
  }

  // Export gauges
  for (const gauge of gauges.values()) {
    lines.push(`# HELP ${gauge.name} ${gauge.help}`);
    lines.push(`# TYPE ${gauge.name} gauge`);

    if (gauge.values.size === 0) {
      lines.push(`${gauge.name} 0`);
    } else {
      for (const [key, value] of gauge.values) {
        const labels = key ? `{${key}}` : "";
        lines.push(`${gauge.name}${labels} ${value}`);
      }
    }
    lines.push("");
  }

  // Export histograms
  for (const hist of histograms.values()) {
    lines.push(`# HELP ${hist.name} ${hist.help}`);
    lines.push(`# TYPE ${hist.name} histogram`);

    for (const [key, data] of hist.values) {
      const baseLabels = key ? `${key},` : "";

      // Bucket values (cumulative)
      let cumulative = 0;
      for (let i = 0; i < hist.buckets.length; i++) {
        cumulative += data.buckets[i];
        lines.push(
          `${hist.name}_bucket{${baseLabels}le="${hist.buckets[i]}"} ${cumulative}`,
        );
      }
      lines.push(`${hist.name}_bucket{${baseLabels}le="+Inf"} ${data.count}`);

      // Sum and count
      const labels = key ? `{${key}}` : "";
      lines.push(`${hist.name}_sum${labels} ${data.sum}`);
      lines.push(`${hist.name}_count${labels} ${data.count}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Pre-defined application metrics
export const Metrics = {
  // HTTP metrics
  httpRequestsTotal: counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "route", "status"],
  ),
  httpRequestDuration: histogram(
    "http_request_duration_ms",
    "HTTP request duration in milliseconds",
    ["method", "route"],
  ),

  // Database metrics
  dbQueriesTotal: counter(
    "db_queries_total",
    "Total number of database queries",
    ["operation"],
  ),
  dbQueryDuration: histogram(
    "db_query_duration_ms",
    "Database query duration in milliseconds",
    ["operation"],
  ),

  // Cache metrics
  cacheHitsTotal: counter("cache_hits_total", "Total number of cache hits", [
    "cache",
  ]),
  cacheMissesTotal: counter(
    "cache_misses_total",
    "Total number of cache misses",
    ["cache"],
  ),
  cacheSize: gauge("cache_size", "Current cache size", ["cache"]),

  // Authentication metrics
  authAttemptsTotal: counter(
    "auth_attempts_total",
    "Total authentication attempts",
    ["method", "status"],
  ),
  activeSessionsGauge: gauge(
    "active_sessions",
    "Number of active user sessions",
  ),

  // Business metrics
  threatModelsTotal: gauge(
    "threat_models_total",
    "Total number of threat models",
  ),
  threatsTotal: gauge("threats_total", "Total number of threats", [
    "severity",
    "status",
  ]),
  mitigationsTotal: gauge("mitigations_total", "Total number of mitigations", [
    "status",
  ]),

  // AI metrics
  aiRequestsTotal: counter("ai_requests_total", "Total AI provider requests", [
    "provider",
    "status",
  ]),
  aiRequestDuration: histogram(
    "ai_request_duration_ms",
    "AI request duration in milliseconds",
    ["provider"],
  ),
  aiTokensTotal: counter("ai_tokens_total", "Total AI tokens used", [
    "provider",
    "type",
  ]),

  // AI OUTPUT QUALITY metrics.
  //
  // The metrics above measure cost, latency and availability — nothing about
  // whether the output was any good. These two are the cheapest available
  // quality signal, and the only one that moves when a prompt changes.
  //
  // aiThreatReviewsTotal is a PRECISION proxy: of the AI threats a human ruled
  // on, what share did they accept? Compute
  //   accepted / (accepted + rejected + modified)
  // Note this is a proxy, not ground truth — it measures agreement with the
  // reviewer, and only over threats someone actually reviewed.
  aiThreatReviewsTotal: counter(
    "ai_threat_reviews_total",
    "Human review decisions on AI-suggested threats (precision proxy)",
    ["methodology", "decision"],
  ),
  // Structural reliability: a spike here is the fastest tripwire for a prompt
  // or provider change that broke output parsing.
  aiParseFailuresTotal: counter(
    "ai_parse_failures_total",
    "LLM responses that failed to parse or validate",
    ["stage"],
  ),

  // Replies that stopped at the max-tokens cap and may be partial lists.
  aiTruncatedResponsesTotal: counter(
    "ai_truncated_responses_total",
    "LLM responses that stopped at max tokens (finish_reason=length)",
    ["stage"],
  ),

  // WebSocket metrics
  wsConnectionsGauge: gauge("ws_connections", "Active WebSocket connections"),
  wsMessagesTotal: counter("ws_messages_total", "Total WebSocket messages", [
    "type",
  ]),

  // Error metrics
  errorsTotal: counter("errors_total", "Total errors", ["type", "code"]),
};
