import { logger } from '../shared/logger.js';

const monitorLogger = logger.child({ component: 'monitoring' });

/**
 * Application metrics collection.
 * In production, push to Prometheus/Grafana/Datadog.
 * For MVP: in-memory counters with periodic logging.
 */

interface Metrics {
  // HTTP
  httpRequestsTotal: number;
  httpRequestDurationMs: number[];
  httpErrorsTotal: number;

  // WebSocket
  wsConnectionsActive: number;
  wsConnectionsTotal: number;
  wsMessagesIn: number;
  wsMessagesOut: number;

  // Auth
  otpStartTotal: number;
  otpVerifySuccess: number;
  otpVerifyFailed: number;
  loginTotal: number;

  // Messages
  messagesSent: number;
  messagesDelivered: number;

  // Errors
  unhandledErrors: number;
}

const metrics: Metrics = {
  httpRequestsTotal: 0,
  httpRequestDurationMs: [],
  httpErrorsTotal: 0,
  wsConnectionsActive: 0,
  wsConnectionsTotal: 0,
  wsMessagesIn: 0,
  wsMessagesOut: 0,
  otpStartTotal: 0,
  otpVerifySuccess: 0,
  otpVerifyFailed: 0,
  loginTotal: 0,
  messagesSent: 0,
  messagesDelivered: 0,
  unhandledErrors: 0,
};

/** Increment a counter metric. */
export function incMetric(name: keyof Metrics): void {
  const val = metrics[name];
  if (typeof val === 'number') {
    (metrics[name] as number) = val + 1;
  }
}

/** Record a duration metric (e.g., HTTP request time). */
export function recordDuration(name: keyof Metrics, durationMs: number): void {
  const arr = metrics[name];
  if (Array.isArray(arr)) {
    arr.push(durationMs);
    // Keep last 1000 samples
    if (arr.length > 1000) arr.shift();
  }
}

/** Set a gauge metric (e.g., active connections). */
export function setMetric(name: keyof Metrics, value: number): void {
  if (typeof metrics[name] === 'number') {
    (metrics[name] as number) = value;
  }
}

/** Get current metrics snapshot. */
export function getMetrics(): Record<string, unknown> {
  const durations = metrics.httpRequestDurationMs;
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  return {
    http: {
      requestsTotal: metrics.httpRequestsTotal,
      errorsTotal: metrics.httpErrorsTotal,
      latency: { avg: Math.round(avg), p50, p95, p99 },
    },
    websocket: {
      connectionsActive: metrics.wsConnectionsActive,
      connectionsTotal: metrics.wsConnectionsTotal,
      messagesIn: metrics.wsMessagesIn,
      messagesOut: metrics.wsMessagesOut,
    },
    auth: {
      otpStartTotal: metrics.otpStartTotal,
      otpVerifySuccess: metrics.otpVerifySuccess,
      otpVerifyFailed: metrics.otpVerifyFailed,
      loginTotal: metrics.loginTotal,
    },
    messages: {
      sent: metrics.messagesSent,
      delivered: metrics.messagesDelivered,
    },
    errors: {
      unhandled: metrics.unhandledErrors,
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}

/** Start periodic metrics logging (every 60 seconds in production). */
export function startMetricsReporter(): void {
  const intervalMs = process.env['NODE_ENV'] === 'production' ? 60000 : 300000;

  setInterval(() => {
    monitorLogger.info(getMetrics(), 'Metrics report');
  }, intervalMs);

  monitorLogger.info(`Metrics reporter started (interval: ${intervalMs / 1000}s)`);
}

/**
 * Prometheus-compatible metrics endpoint output.
 * Wire to GET /metrics (behind auth or internal network).
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [
    '# HELP enterchat_http_requests_total Total HTTP requests',
    '# TYPE enterchat_http_requests_total counter',
    `enterchat_http_requests_total ${metrics.httpRequestsTotal}`,
    '',
    '# HELP enterchat_http_errors_total Total HTTP errors',
    '# TYPE enterchat_http_errors_total counter',
    `enterchat_http_errors_total ${metrics.httpErrorsTotal}`,
    '',
    '# HELP enterchat_ws_connections_active Active WebSocket connections',
    '# TYPE enterchat_ws_connections_active gauge',
    `enterchat_ws_connections_active ${metrics.wsConnectionsActive}`,
    '',
    '# HELP enterchat_messages_sent_total Total messages sent',
    '# TYPE enterchat_messages_sent_total counter',
    `enterchat_messages_sent_total ${metrics.messagesSent}`,
    '',
    '# HELP enterchat_uptime_seconds Server uptime',
    '# TYPE enterchat_uptime_seconds gauge',
    `enterchat_uptime_seconds ${Math.round(process.uptime())}`,
  ];

  return lines.join('\n');
}
