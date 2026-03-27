import { PortalSource, Tender } from './tender';

export enum ConnectorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  SYNCING = 'SYNCING',
  RATE_LIMITED = 'RATE_LIMITED',
}

export interface ConnectorHealth {
  source: PortalSource;
  status: ConnectorStatus;
  lastSync?: Date;
  nextSync?: Date;
  errorMessage?: string;
  successRate: number;
  avgSyncDurationMs: number;
  totalSynced: number;
  lastSyncCount: number;
}

export interface SyncResult {
  source: PortalSource;
  success: boolean;
  totalFetched: number;
  newRecords: number;
  updatedRecords: number;
  errorCount: number;
  durationMs: number;
  errors: string[];
  syncedAt: Date;
}

export interface ConnectorConfig {
  source: PortalSource;
  enabled: boolean;
  syncIntervalMinutes: number;
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  timeout: number;
  rateLimit?: {
    requestsPerMinute: number;
    delayBetweenRequestsMs: number;
  };
}

export interface IConnector {
  readonly source: PortalSource;
  readonly config: ConnectorConfig;
  fetchTenders(since?: Date, page?: number): Promise<Tender[]>;
  fetchTenderById(externalId: string): Promise<Tender | null>;
  getHealth(): Promise<ConnectorHealth>;
  testConnection(): Promise<boolean>;
}

export interface ConnectorRegistry {
  get(source: PortalSource): IConnector;
  getAll(): IConnector[];
  getEnabled(): IConnector[];
}

export interface SyncJob {
  id: string;
  source: PortalSource;
  type: 'FULL' | 'INCREMENTAL' | 'SINGLE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  result?: SyncResult;
  createdAt: Date;
}
