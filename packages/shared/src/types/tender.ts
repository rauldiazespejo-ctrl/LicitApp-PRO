import { z } from 'zod';

export enum TenderStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  AWARDED = 'AWARDED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
}

export enum TenderCategory {
  GOODS = 'GOODS',
  SERVICES = 'SERVICES',
  WORKS = 'WORKS',
  CONSULTING = 'CONSULTING',
  TECHNOLOGY = 'TECHNOLOGY',
  MINING = 'MINING',
  ENERGY = 'ENERGY',
  OTHER = 'OTHER',
}

export enum PortalSource {
  WHEREX = 'WHEREX',
  PORTAL_MINERO = 'PORTAL_MINERO',
  SAP_ARIBA = 'SAP_ARIBA',
  SICEP = 'SICEP',
  COUPA = 'COUPA',
  CHILECOMPRA = 'CHILECOMPRA',
}

export interface TenderDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedAt?: Date;
}

export interface TenderContact {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
}

export interface TenderBudget {
  amount?: number;
  currency: string;
  isEstimate: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface TenderRequirement {
  id: string;
  description: string;
  mandatory: boolean;
  type: 'TECHNICAL' | 'FINANCIAL' | 'LEGAL' | 'OTHER';
}

export interface Tender {
  id: string;
  externalId: string;
  source: PortalSource;
  title: string;
  description: string;
  status: TenderStatus;
  category: TenderCategory;
  subcategory?: string;
  buyer: {
    id?: string;
    name: string;
    rut?: string;
    region?: string;
    commune?: string;
    type?: 'PUBLIC' | 'PRIVATE';
  };
  budget?: TenderBudget;
  publishedAt?: Date;
  openingDate?: Date;
  closingDate?: Date;
  awardDate?: Date;
  documents: TenderDocument[];
  contacts: TenderContact[];
  requirements: TenderRequirement[];
  tags: string[];
  regions: string[];
  rawData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

export const TenderFilterSchema = z.object({
  search: z.string().optional(),
  sources: z.array(z.nativeEnum(PortalSource)).optional(),
  statuses: z.array(z.nativeEnum(TenderStatus)).optional(),
  categories: z.array(z.nativeEnum(TenderCategory)).optional(),
  regions: z.array(z.string()).optional(),
  minBudget: z.number().optional(),
  maxBudget: z.number().optional(),
  currency: z.string().optional(),
  buyerName: z.string().optional(),
  publishedAfter: z.coerce.date().optional(),
  publishedBefore: z.coerce.date().optional(),
  closingAfter: z.coerce.date().optional(),
  closingBefore: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['publishedAt', 'closingDate', 'budget', 'title', 'relevance']).default('publishedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type TenderFilter = z.infer<typeof TenderFilterSchema>;

export interface TenderListResponse {
  data: Tender[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: {
    sources: { value: PortalSource; count: number }[];
    statuses: { value: TenderStatus; count: number }[];
    categories: { value: TenderCategory; count: number }[];
    regions: { value: string; count: number }[];
  };
}
