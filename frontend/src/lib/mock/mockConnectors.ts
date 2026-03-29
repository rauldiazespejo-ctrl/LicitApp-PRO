export const MOCK_CONNECTORS = [
  { source: 'CHILECOMPRA', status: 'ACTIVE', lastSync: new Date(Date.now() - 15 * 60 * 1000).toISOString(), successRate: 0.98, totalSynced: 12450 },
  { source: 'WHEREX', status: 'ACTIVE', lastSync: new Date(Date.now() - 45 * 60 * 1000).toISOString(), successRate: 1.0, totalSynced: 3200 },
  { source: 'SAP_ARIBA', status: 'ACTIVE', lastSync: new Date(Date.now() - 120 * 60 * 1000).toISOString(), successRate: 0.95, totalSynced: 1500 },
  { source: 'SICEP', status: 'ACTIVE', lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString(), successRate: 0.99, totalSynced: 8700 },
  { source: 'COUPA', status: 'ACTIVE', lastSync: new Date(Date.now() - 180 * 60 * 1000).toISOString(), successRate: 0.97, totalSynced: 2100 },
  { source: 'PORTAL_MINERO', status: 'ACTIVE', lastSync: new Date(Date.now() - 60 * 60 * 1000).toISOString(), successRate: 0.92, totalSynced: 4300 },
];

export const MOCK_SYNC_JOBS = [
  { id: 'job-1', source: 'CHILECOMPRA', type: 'INCREMENTAL', status: 'COMPLETED', result: { totalFetched: 124, durationMs: 45000 }, createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  { id: 'job-2', source: 'WHEREX', type: 'FULL', status: 'COMPLETED', result: { totalFetched: 3200, durationMs: 600000 }, createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { id: 'job-3', source: 'SICEP', type: 'INCREMENTAL', status: 'RUNNING', result: { totalFetched: 45, durationMs: 12000 }, createdAt: new Date().toISOString() },
  { id: 'job-4', source: 'SAP_ARIBA', type: 'INCREMENTAL', status: 'FAILED', errorMessage: 'Timeout de conexión API Gateway', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `job-mock-${i}`,
    source: ['CHILECOMPRA', 'WHEREX', 'SICEP', 'COUPA', 'PORTAL_MINERO'][i % 5],
    type: 'INCREMENTAL',
    status: 'COMPLETED',
    result: { totalFetched: Math.floor(Math.random() * 50), durationMs: 15000 + (Math.random() * 20000) },
    createdAt: new Date(Date.now() - (i + 2) * 60 * 60 * 1000).toISOString()
  }))
];
