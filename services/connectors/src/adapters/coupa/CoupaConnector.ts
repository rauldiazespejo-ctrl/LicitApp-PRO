import {
  Tender,
  TenderStatus,
  TenderCategory,
  PortalSource,
  ConnectorConfig,
} from '@licitapp/shared';
import { BaseConnector } from '../../base/BaseConnector';
import { v4 as uuidv4 } from 'uuid';
import { parseFlexibleDate } from '@licitapp/shared';

interface CoupaRequisition {
  id: number;
  'document-number': string;
  title?: string;
  description?: string;
  status: string;
  'requisition-lines': {
    description?: string;
    commodity?: { name: string };
    'unit-price'?: number;
    currency?: { code: string };
    quantity?: number;
  }[];
  'submitted-at'?: string;
  'closed-at'?: string;
  'requested-by'?: { name: string; email: string };
  'ship-to-attention'?: string;
  attachments?: { filename: string; url: string }[];
}

interface CoupaResponse {
  requisitions: CoupaRequisition[];
  'total-count': number;
}

export class CoupaConnector extends BaseConnector {
  readonly source = PortalSource.COUPA;

  constructor() {
    const config: ConnectorConfig = {
      source: PortalSource.COUPA,
      enabled: true,
      syncIntervalMinutes: 60,
      batchSize: 50,
      maxRetries: 3,
      retryDelayMs: 2000,
      timeout: 30000,
      rateLimit: { requestsPerMinute: 30, delayBetweenRequestsMs: 2000 },
    };
    super(config);
    this.http.defaults.baseURL = process.env.COUPA_API_URL ?? 'https://yourinstance.coupahost.com/api';
    this.http.defaults.headers['X-COUPA-API-KEY'] = process.env.COUPA_API_KEY ?? '';
    this.http.defaults.headers['Accept'] = 'application/json';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.http.get('/user_groups?return_object=limited&fields=["id"]');
      return true;
    } catch {
      return false;
    }
  }

  async fetchTenders(since?: Date, page = 1): Promise<Tender[]> {
    const offset = (page - 1) * this.config.batchSize;

    const params: Record<string, unknown> = {
      return_object: 'limited',
      limit: this.config.batchSize,
      offset,
      'fields[]': ['id', 'document-number', 'title', 'description', 'status',
        'submitted-at', 'closed-at', 'requested-by', 'requisition-lines', 'attachments'],
    };
    if (since) {
      params['submitted_at[gt_or_eq]'] = since.toISOString();
    }

    const response = await this.throttled(() =>
      this.http.get<CoupaRequisition[]>('/requisitions', { params })
    );

    const items = Array.isArray(response.data) ? response.data : [];
    return items.map((raw) => this.mapToTender(raw));
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    try {
      const response = await this.throttled(() =>
        this.http.get<CoupaRequisition>(`/requisitions/${externalId}`)
      );
      return this.mapToTender(response.data);
    } catch {
      return null;
    }
  }

  private mapToTender(raw: CoupaRequisition): Tender {
    const lines = raw['requisition-lines'] ?? [];
    const totalAmount = lines.reduce((sum, line) => {
      const price = line['unit-price'] ?? 0;
      const qty = line.quantity ?? 1;
      return sum + price * qty;
    }, 0);
    const currency = lines[0]?.currency?.code ?? 'USD';
    const commodityNames = lines.map((l) => l.commodity?.name).filter(Boolean) as string[];

    return {
      id: uuidv4(),
      externalId: String(raw.id),
      source: PortalSource.COUPA,
      title: raw.title ?? raw['document-number'] ?? `Requisición ${raw.id}`,
      description: raw.description ?? lines.map((l) => l.description).filter(Boolean).join('; '),
      status: raw.status === 'closed' ? TenderStatus.CLOSED :
        raw.status === 'approved' ? TenderStatus.OPEN : TenderStatus.PUBLISHED,
      category: TenderCategory.GOODS,
      buyer: {
        name: raw['requested-by']?.name ?? process.env.COUPA_INSTANCE ?? 'Coupa Instance',
        type: 'PRIVATE',
      },
      budget: totalAmount > 0 ? { amount: totalAmount, currency, isEstimate: false } : undefined,
      publishedAt: parseFlexibleDate(raw['submitted-at']),
      closingDate: parseFlexibleDate(raw['closed-at']),
      documents: (raw.attachments ?? []).map((a) => ({
        id: uuidv4(), name: a.filename, url: a.url, type: 'ATTACHMENT',
      })),
      contacts: raw['requested-by']
        ? [{ name: raw['requested-by'].name, email: raw['requested-by'].email }]
        : [],
      requirements: [],
      tags: ['coupa', ...commodityNames.slice(0, 5)],
      regions: [],
      rawData: raw as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
    };
  }
}
