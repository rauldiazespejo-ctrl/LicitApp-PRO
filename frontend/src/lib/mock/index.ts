import { MOCK_TENDERS } from './mockTenders';
import { MOCK_CONNECTORS, MOCK_SYNC_JOBS } from './mockConnectors';
import { filterTenders } from './mockEngine';
import * as analytics from './mockAnalytics';

export const mockRouter = async (config: any) => {
  const url = config.url || '';
  const params = config.params || {};

  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));

  // --- TENDERS ---
  if (url === '/tenders/stats/summary') {
    const bySource = MOCK_TENDERS.reduce((acc: any, t) => {
      acc[t.source] = (acc[t.source] || 0) + 1;
      return acc;
    }, {});
    const byStatus = MOCK_TENDERS.reduce((acc: any, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return { total: MOCK_TENDERS.length, bySource, byStatus };
  }

  if (url.startsWith('/tenders/')) {
    const id = url.split('/').pop();
    const tender = MOCK_TENDERS.find(t => t.id === id || t.externalId === id);
    if (tender) return tender;
  }

  if (url === '/tenders') {
    return filterTenders(params);
  }

  // --- CONNECTORS ---
  if (url === '/connectors/jobs') return { data: MOCK_SYNC_JOBS };
  if (url === '/connectors') return MOCK_CONNECTORS;
  if (url.match(/\/connectors\/.*\/sync/)) return { success: true, message: 'Sync enqueued' };

  // --- ANALYTICS ---
  if (url === '/analytics/summary') return analytics.getSummary();
  if (url === '/analytics/temporal') return analytics.getTemporal();
  if (url === '/analytics/top-buyers') return analytics.getTopBuyers();
  if (url === '/analytics/unspsc') return analytics.getUnspsc();
  if (url === '/analytics/closing-alerts') return analytics.getClosingAlerts();

  // --- AUTH / OTHERS ---
  if (url === '/auth/logout') return { success: true };
  if (url.startsWith('/users/saved-tenders')) return { data: [], total: 0 };

  // Fallback
  return { data: [], total: 0 };
};
