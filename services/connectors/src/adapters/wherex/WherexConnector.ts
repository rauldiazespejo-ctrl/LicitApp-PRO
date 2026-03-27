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

interface WherexTender {
  id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  categoria: string;
  comprador: {
    id: string;
    nombre: string;
    rut?: string;
    region?: string;
  };
  presupuesto?: {
    monto: number;
    moneda: string;
  };
  fechaPublicacion?: string;
  fechaApertura?: string;
  fechaCierre?: string;
  documentos?: { nombre: string; url: string; tipo: string }[];
  contactos?: { nombre: string; email: string; telefono?: string }[];
  etiquetas?: string[];
  regiones?: string[];
}

interface WherexResponse {
  data: WherexTender[];
  meta: { total: number; page: number; perPage: number };
}

const STATUS_MAP: Record<string, TenderStatus> = {
  borrador: TenderStatus.DRAFT,
  publicada: TenderStatus.PUBLISHED,
  abierta: TenderStatus.OPEN,
  cerrada: TenderStatus.CLOSED,
  adjudicada: TenderStatus.AWARDED,
  cancelada: TenderStatus.CANCELLED,
  suspendida: TenderStatus.SUSPENDED,
};

const CATEGORY_MAP: Record<string, TenderCategory> = {
  bienes: TenderCategory.GOODS,
  servicios: TenderCategory.SERVICES,
  obras: TenderCategory.WORKS,
  consultoria: TenderCategory.CONSULTING,
  tecnologia: TenderCategory.TECHNOLOGY,
  mineria: TenderCategory.MINING,
  energia: TenderCategory.ENERGY,
};

export class WherexConnector extends BaseConnector {
  readonly source = PortalSource.WHEREX;

  constructor() {
    const config: ConnectorConfig = {
      source: PortalSource.WHEREX,
      enabled: true,
      syncIntervalMinutes: 60,
      batchSize: 100,
      maxRetries: 3,
      retryDelayMs: 1000,
      timeout: 30000,
      rateLimit: { requestsPerMinute: 60, delayBetweenRequestsMs: 1000 },
    };
    super(config);
    this.http.defaults.baseURL = process.env.WHEREX_API_URL ?? 'https://api.wherex.cl/v1';
    this.http.defaults.headers['X-API-Key'] = process.env.WHEREX_API_KEY ?? '';
    this.http.defaults.headers['X-Client-ID'] = process.env.WHEREX_CLIENT_ID ?? '';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.http.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  async fetchTenders(since?: Date, page = 1): Promise<Tender[]> {
    const response = await this.throttled(() =>
      this.http.get<WherexResponse>('/licitapp', {
        params: {
          page,
          per_page: this.config.batchSize,
          ...(since ? { fecha_desde: since.toISOString() } : {}),
          sort: 'fecha_publicacion',
          order: 'desc',
        },
      })
    );

    return response.data.data.map((raw) => this.mapToTender(raw));
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    try {
      const response = await this.throttled(() =>
        this.http.get<WherexTender>(`/licitapp/${externalId}`)
      );
      return this.mapToTender(response.data);
    } catch {
      return null;
    }
  }

  private mapToTender(raw: WherexTender): Tender {
    return {
      id: uuidv4(),
      externalId: raw.id,
      source: PortalSource.WHEREX,
      title: raw.titulo,
      description: raw.descripcion,
      status: STATUS_MAP[raw.estado?.toLowerCase()] ?? TenderStatus.PUBLISHED,
      category: CATEGORY_MAP[raw.categoria?.toLowerCase()] ?? TenderCategory.OTHER,
      buyer: {
        id: raw.comprador.id,
        name: raw.comprador.nombre,
        rut: raw.comprador.rut,
        region: raw.comprador.region,
        type: 'PRIVATE',
      },
      budget: raw.presupuesto
        ? { amount: raw.presupuesto.monto, currency: raw.presupuesto.moneda, isEstimate: false }
        : undefined,
      publishedAt: parseFlexibleDate(raw.fechaPublicacion),
      openingDate: parseFlexibleDate(raw.fechaApertura),
      closingDate: parseFlexibleDate(raw.fechaCierre),
      documents: (raw.documentos ?? []).map((d) => ({
        id: uuidv4(), name: d.nombre, url: d.url, type: d.tipo,
      })),
      contacts: (raw.contactos ?? []).map((c) => ({
        name: c.nombre, email: c.email, phone: c.telefono,
      })),
      requirements: [],
      tags: raw.etiquetas ?? [],
      regions: raw.regiones ?? [],
      rawData: raw as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
    };
  }
}
