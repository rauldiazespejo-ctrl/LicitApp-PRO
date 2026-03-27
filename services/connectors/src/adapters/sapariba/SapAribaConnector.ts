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

interface AribaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AribaRFx {
  Id: string;
  Title: string;
  Description: string;
  Status: string;
  BidType: string;
  BuyerOrg: { Name: string; Id: string };
  BidOpeningDate?: string;
  BidCloseDate?: string;
  PublishDate?: string;
  BudgetAmount?: number;
  Currency?: string;
  Documents?: { FileName: string; URL: string }[];
}

interface AribaResponse {
  RFxList: AribaRFx[];
  TotalResults: number;
}

const STATUS_MAP: Record<string, TenderStatus> = {
  Open: TenderStatus.OPEN,
  Closed: TenderStatus.CLOSED,
  Awarded: TenderStatus.AWARDED,
  Cancelled: TenderStatus.CANCELLED,
  Pending: TenderStatus.PUBLISHED,
};

export class SapAribaConnector extends BaseConnector {
  readonly source = PortalSource.SAP_ARIBA;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor() {
    const config: ConnectorConfig = {
      source: PortalSource.SAP_ARIBA,
      enabled: true,
      syncIntervalMinutes: 120,
      batchSize: 50,
      maxRetries: 3,
      retryDelayMs: 2000,
      timeout: 45000,
      rateLimit: { requestsPerMinute: 30, delayBetweenRequestsMs: 2000 },
    };
    super(config);
    this.http.defaults.baseURL = process.env.ARIBA_API_URL ?? 'https://openapi.ariba.com';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return !!this.accessToken;
    } catch {
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    logger.info('[SAP_ARIBA] Refreshing OAuth token');

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ARIBA_CLIENT_ID ?? '',
      client_secret: process.env.ARIBA_CLIENT_SECRET ?? '',
    });

    const response = await this.http.post<AribaTokenResponse>(
      '/api/oauth/v1/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': process.env.ARIBA_API_KEY ?? '',
        },
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
    return this.accessToken;
  }

  async fetchTenders(since?: Date, page = 1): Promise<Tender[]> {
    const token = await this.getAccessToken();
    const offset = (page - 1) * this.config.batchSize;

    const response = await this.throttled(() =>
      this.http.get<AribaResponse>('/api/procurement/v1/rfxs', {
        headers: {
          Authorization: `Bearer ${token}`,
          'apikey': process.env.ARIBA_API_KEY ?? '',
        },
        params: {
          realm: process.env.ARIBA_REALM ?? '',
          $top: this.config.batchSize,
          $skip: offset,
          ...(since ? { publishedAfter: since.toISOString() } : {}),
        },
      })
    );

    return response.data.RFxList.map((raw) => this.mapToTender(raw));
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    try {
      const token = await this.getAccessToken();
      const response = await this.throttled(() =>
        this.http.get<AribaRFx>(`/api/procurement/v1/rfxs/${externalId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'apikey': process.env.ARIBA_API_KEY ?? '',
          },
          params: { realm: process.env.ARIBA_REALM ?? '' },
        })
      );
      return this.mapToTender(response.data);
    } catch {
      return null;
    }
  }

  private mapToTender(raw: AribaRFx): Tender {
    return {
      id: uuidv4(),
      externalId: raw.Id,
      source: PortalSource.SAP_ARIBA,
      title: raw.Title,
      description: raw.Description ?? '',
      status: STATUS_MAP[raw.Status] ?? TenderStatus.PUBLISHED,
      category: this.inferCategory(raw.BidType),
      buyer: {
        id: raw.BuyerOrg?.Id,
        name: raw.BuyerOrg?.Name ?? 'SAP Ariba Buyer',
        type: 'PRIVATE',
      },
      budget: raw.BudgetAmount
        ? { amount: raw.BudgetAmount, currency: raw.Currency ?? 'USD', isEstimate: false }
        : undefined,
      publishedAt: parseFlexibleDate(raw.PublishDate),
      openingDate: parseFlexibleDate(raw.BidOpeningDate),
      closingDate: parseFlexibleDate(raw.BidCloseDate),
      documents: (raw.Documents ?? []).map((d) => ({
        id: uuidv4(), name: d.FileName, url: d.URL, type: 'PDF',
      })),
      contacts: [],
      requirements: [],
      tags: ['sap-ariba'],
      regions: [],
      rawData: raw as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
    };
  }

  private inferCategory(bidType?: string): TenderCategory {
    if (!bidType) return TenderCategory.OTHER;
    const lower = bidType.toLowerCase();
    if (lower.includes('good') || lower.includes('material')) return TenderCategory.GOODS;
    if (lower.includes('service')) return TenderCategory.SERVICES;
    if (lower.includes('work') || lower.includes('construction')) return TenderCategory.WORKS;
    if (lower.includes('consult')) return TenderCategory.CONSULTING;
    if (lower.includes('tech') || lower.includes('it') || lower.includes('software')) return TenderCategory.TECHNOLOGY;
    return TenderCategory.OTHER;
  }
}
