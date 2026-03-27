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

interface SicepLicitacion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  estado: string;
  tipo: string;
  organismo: {
    codigo: string;
    nombre: string;
    rut: string;
    region: string;
    comuna: string;
  };
  montoEstimado?: number;
  moneda?: string;
  fechaPublicacion?: string;
  fechaApertura?: string;
  fechaCierre?: string;
  documentos?: { nombre: string; url: string }[];
  contacto?: { nombre: string; email: string; telefono?: string };
  rubros?: string[];
  regiones?: string[];
}

interface SicepResponse {
  licitapp: SicepLicitacion[];
  totalRegistros: number;
  pagina: number;
}

const STATUS_MAP: Record<string, TenderStatus> = {
  PUBLICADA: TenderStatus.PUBLISHED,
  ABIERTA: TenderStatus.OPEN,
  CERRADA: TenderStatus.CLOSED,
  ADJUDICADA: TenderStatus.AWARDED,
  DESIERTA: TenderStatus.CANCELLED,
  SUSPENDIDA: TenderStatus.SUSPENDED,
  REVOCADA: TenderStatus.CANCELLED,
};

export class SicepConnector extends BaseConnector {
  readonly source = PortalSource.SICEP;

  constructor() {
    const config: ConnectorConfig = {
      source: PortalSource.SICEP,
      enabled: true,
      syncIntervalMinutes: 90,
      batchSize: 100,
      maxRetries: 3,
      retryDelayMs: 1500,
      timeout: 30000,
      rateLimit: { requestsPerMinute: 40, delayBetweenRequestsMs: 1500 },
    };
    super(config);
    this.http.defaults.baseURL = process.env.SICEP_API_URL ?? 'https://api.sicep.cl/v1';
    this.http.defaults.headers['X-API-Key'] = process.env.SICEP_API_KEY ?? '';
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
      this.http.get<SicepResponse>('/licitapp', {
        params: {
          pagina: page,
          registrosPorPagina: this.config.batchSize,
          ...(since ? { fechaDesde: since.toISOString().split('T')[0] } : {}),
          ordenarPor: 'fechaPublicacion',
          orden: 'DESC',
        },
        auth: {
          username: process.env.SICEP_USERNAME ?? '',
          password: process.env.SICEP_PASSWORD ?? '',
        },
      })
    );

    return response.data.licitapp.map((raw) => this.mapToTender(raw));
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    try {
      const response = await this.throttled(() =>
        this.http.get<SicepLicitacion>(`/licitapp/${externalId}`, {
          auth: {
            username: process.env.SICEP_USERNAME ?? '',
            password: process.env.SICEP_PASSWORD ?? '',
          },
        })
      );
      return this.mapToTender(response.data);
    } catch {
      return null;
    }
  }

  private mapToTender(raw: SicepLicitacion): Tender {
    return {
      id: uuidv4(),
      externalId: raw.id ?? raw.codigo,
      source: PortalSource.SICEP,
      title: raw.nombre,
      description: raw.descripcion ?? '',
      status: STATUS_MAP[raw.estado?.toUpperCase()] ?? TenderStatus.PUBLISHED,
      category: this.inferCategory(raw.tipo, raw.rubros),
      buyer: {
        id: raw.organismo.codigo,
        name: raw.organismo.nombre,
        rut: raw.organismo.rut,
        region: raw.organismo.region,
        commune: raw.organismo.comuna,
        type: 'PUBLIC',
      },
      budget: raw.montoEstimado
        ? { amount: raw.montoEstimado, currency: raw.moneda ?? 'CLP', isEstimate: true }
        : undefined,
      publishedAt: parseFlexibleDate(raw.fechaPublicacion),
      openingDate: parseFlexibleDate(raw.fechaApertura),
      closingDate: parseFlexibleDate(raw.fechaCierre),
      documents: (raw.documentos ?? []).map((d) => ({
        id: uuidv4(), name: d.nombre, url: d.url, type: 'PDF',
      })),
      contacts: raw.contacto
        ? [{ name: raw.contacto.nombre, email: raw.contacto.email, phone: raw.contacto.telefono }]
        : [],
      requirements: [],
      tags: raw.rubros ?? [],
      regions: raw.regiones ?? (raw.organismo.region ? [raw.organismo.region] : []),
      rawData: raw as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
    };
  }

  private inferCategory(tipo?: string, rubros?: string[]): TenderCategory {
    const combined = [(tipo ?? ''), ...(rubros ?? [])].join(' ').toLowerCase();
    if (combined.includes('bien') || combined.includes('suministro')) return TenderCategory.GOODS;
    if (combined.includes('servicio')) return TenderCategory.SERVICES;
    if (combined.includes('obra') || combined.includes('construccion')) return TenderCategory.WORKS;
    if (combined.includes('consultoria') || combined.includes('asesor')) return TenderCategory.CONSULTING;
    if (combined.includes('tecnologia') || combined.includes('software') || combined.includes('ti')) return TenderCategory.TECHNOLOGY;
    if (combined.includes('mineria') || combined.includes('mineral')) return TenderCategory.MINING;
    if (combined.includes('energia') || combined.includes('electric')) return TenderCategory.ENERGY;
    return TenderCategory.OTHER;
  }
}
