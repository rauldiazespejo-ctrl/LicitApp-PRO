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
import { logger } from '../../config/logger';

interface OCDSRelease {
  ocid: string;
  id: string;
  date?: string;
  tag?: string[];
  tender?: {
    id: string;
    title: string;
    description?: string;
    status?: string;
    mainProcurementCategory?: string;
    procurementMethod?: string;
    value?: { amount: number; currency: string };
    tenderPeriod?: { startDate?: string; endDate?: string };
    awardPeriod?: { endDate?: string };
    documents?: { id: string; title: string; url?: string; documentType?: string }[];
    enquiryPeriod?: { endDate?: string };
    items?: { id: string; description?: string; classification?: { description?: string } }[];
  };
  buyer?: { name: string; id?: string };
  awards?: { value?: { amount: number; currency: string }; date?: string; status?: string }[];
  contracts?: { id: string; status?: string }[];
}

interface ChileCompraOCDSResponse {
  releases: OCDSRelease[];
  total: number;
  pageSize: number;
  page: number;
}

const STATUS_MAP: Record<string, TenderStatus> = {
  active: TenderStatus.OPEN,
  complete: TenderStatus.CLOSED,
  cancelled: TenderStatus.CANCELLED,
  unsuccessful: TenderStatus.CANCELLED,
  awarded: TenderStatus.AWARDED,
  planning: TenderStatus.DRAFT,
};

export class ChileCompraConnector extends BaseConnector {
  readonly source = PortalSource.CHILECOMPRA;
  private readonly syncDelay: number;

  constructor() {
    const config: ConnectorConfig = {
      source: PortalSource.CHILECOMPRA,
      enabled: true,
      syncIntervalMinutes: 30,
      batchSize: parseInt(process.env.CHILECOMPRA_SYNC_BATCH_SIZE ?? '50', 10),
      maxRetries: 5,
      retryDelayMs: 2000,
      timeout: 60000,
      rateLimit: { requestsPerMinute: 20, delayBetweenRequestsMs: 3000 },
    };
    super(config);
    this.syncDelay = parseInt(process.env.CHILECOMPRA_SYNC_DELAY_MS ?? '1000', 10);
    this.http.defaults.baseURL = process.env.CHILECOMPRA_OCDS_URL ?? 'https://api.mercadopublico.cl/OCDS/buysearch';
  }

  async testConnection(): Promise<boolean> {
    try {
      const ticket = process.env.CHILECOMPRA_TICKET;
      await this.http.get('', {
        params: { ticket, fecha: new Date().toISOString().split('T')[0], cantidad: 1, pagina: 1 },
      });
      return true;
    } catch {
      return false;
    }
  }

  async fetchTenders(since?: Date, page = 1): Promise<Tender[]> {
    const ticket = process.env.CHILECOMPRA_TICKET ?? '';
    const fecha = since
      ? since.toISOString().split('T')[0]
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    logger.info(`[CHILECOMPRA] Fetching page ${page} for date ${fecha}`);

    const response = await this.throttled(async () => {
      await new Promise((resolve) => setTimeout(resolve, this.syncDelay));
      return this.http.get<ChileCompraOCDSResponse>('', {
        params: {
          ticket,
          fecha,
          cantidad: this.config.batchSize,
          pagina: page,
        },
      });
    });

    return (response.data.releases ?? []).map((release) => this.mapToTender(release));
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    try {
      const ticket = process.env.CHILECOMPRA_TICKET ?? '';
      const response = await this.throttled(async () => {
        await new Promise((resolve) => setTimeout(resolve, this.syncDelay));
        return this.http.get<{ releases: OCDSRelease[] }>('', {
          params: { ticket, CodigoLicitacion: externalId, cantidad: 1, pagina: 1 },
        });
      });
      const release = response.data.releases?.[0];
      return release ? this.mapToTender(release) : null;
    } catch {
      return null;
    }
  }

  private mapToTender(release: OCDSRelease): Tender {
    const tender = release.tender;
    const award = release.awards?.[0];

    return {
      id: uuidv4(),
      externalId: release.ocid ?? release.id,
      source: PortalSource.CHILECOMPRA,
      title: tender?.title ?? 'Sin título',
      description: tender?.description ?? '',
      status: STATUS_MAP[tender?.status ?? ''] ?? TenderStatus.PUBLISHED,
      category: this.mapCategory(tender?.mainProcurementCategory),
      buyer: {
        name: release.buyer?.name ?? 'Organismo Público',
        id: release.buyer?.id,
        type: 'PUBLIC',
      },
      budget: tender?.value?.amount
        ? { amount: tender.value.amount, currency: tender.value.currency ?? 'CLP', isEstimate: false }
        : award?.value?.amount
        ? { amount: award.value.amount, currency: award.value.currency ?? 'CLP', isEstimate: false }
        : undefined,
      publishedAt: parseFlexibleDate(release.date),
      openingDate: parseFlexibleDate(tender?.tenderPeriod?.startDate),
      closingDate: parseFlexibleDate(tender?.tenderPeriod?.endDate),
      awardDate: parseFlexibleDate(award?.date),
      documents: (tender?.documents ?? []).map((d) => ({
        id: d.id, name: d.title, url: d.url ?? '', type: d.documentType ?? 'OTHER',
      })),
      contacts: [],
      requirements: [],
      tags: ['chilecompra', 'mercado-publico', tender?.procurementMethod ?? ''].filter(Boolean),
      regions: this.extractRegions(release),
      rawData: release as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
    };
  }

  private mapCategory(category?: string): TenderCategory {
    if (!category) return TenderCategory.OTHER;
    const lower = category.toLowerCase();
    if (lower === 'goods') return TenderCategory.GOODS;
    if (lower === 'services') return TenderCategory.SERVICES;
    if (lower === 'works') return TenderCategory.WORKS;
    if (lower === 'consultingservices') return TenderCategory.CONSULTING;
    return TenderCategory.OTHER;
  }

  private extractRegions(release: OCDSRelease): string[] {
    const regionPatterns = [
      'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
      "O'Higgins", 'Maule', 'Biobío', 'Araucanía', 'Los Lagos',
      'Aysén', 'Magallanes', 'Metropolitana', 'Los Ríos', 'Arica',
      'Ñuble',
    ];
    const text = JSON.stringify(release);
    return regionPatterns.filter((r) => text.includes(r));
  }
}
