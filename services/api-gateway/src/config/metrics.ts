import { collectDefaultMetrics, Counter, Histogram, Gauge, Registry } from 'prom-client';

export const registry = new Registry();

export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

export const activeTenderCount = new Gauge({
  name: 'active_tenders_total',
  help: 'Total number of active tenders per source',
  labelNames: ['source'],
  registers: [registry],
});

export const syncJobsCounter = new Counter({
  name: 'sync_jobs_total',
  help: 'Total sync jobs executed',
  labelNames: ['source', 'status'],
  registers: [registry],
});

export const connectorErrorCounter = new Counter({
  name: 'connector_errors_total',
  help: 'Total connector errors',
  labelNames: ['source', 'error_type'],
  registers: [registry],
});

export function setupMetrics(): void {
  collectDefaultMetrics({ register: registry, prefix: 'licitapp_' });
}
