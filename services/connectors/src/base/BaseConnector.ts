import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';
import pRetry from 'p-retry';
import {
  IConnector,
  ConnectorConfig,
  ConnectorHealth,
  ConnectorStatus,
  PortalSource,
  SyncResult,
  Tender,
} from '@licitapp/shared';
import { logger } from '../config/logger';

export abstract class BaseConnector implements IConnector {
  abstract readonly source: PortalSource;
  readonly config: ConnectorConfig;

  protected readonly http: AxiosInstance;
  protected readonly limiter: Bottleneck;

  private lastSyncAt?: Date;
  private totalSynced = 0;
  private errorCount = 0;
  private successCount = 0;

  constructor(config: ConnectorConfig) {
    this.config = config;

    this.http = axios.create({ timeout: config.timeout });
    axiosRetry(this.http, {
      retries: config.maxRetries,
      retryDelay: (retryCount) => Math.min(1000 * 2 ** retryCount, config.retryDelayMs * 4),
      retryCondition: (err) =>
        axiosRetry.isNetworkError(err) ||
        axiosRetry.isRetryableError(err) ||
        err.response?.status === 429,
    });

    this.limiter = new Bottleneck({
      minTime: config.rateLimit?.delayBetweenRequestsMs ?? 500,
      maxConcurrent: 2,
      reservoir: config.rateLimit?.requestsPerMinute ?? 60,
      reservoirRefreshAmount: config.rateLimit?.requestsPerMinute ?? 60,
      reservoirRefreshInterval: 60 * 1000,
    });
  }

  abstract fetchTenders(since?: Date, page?: number): Promise<Tender[]>;
  abstract fetchTenderById(externalId: string): Promise<Tender | null>;
  abstract testConnection(): Promise<boolean>;

  protected async throttled<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(() =>
      pRetry(fn, {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelayMs,
        onFailedAttempt: (err) => {
          logger.warn(`[${this.source}] Attempt ${err.attemptNumber} failed: ${err.message}`);
        },
      })
    );
  }

  async getHealth(): Promise<ConnectorHealth> {
    const isConnected = await this.testConnection().catch(() => false);
    return {
      source: this.source,
      status: isConnected ? ConnectorStatus.ACTIVE : ConnectorStatus.ERROR,
      lastSync: this.lastSyncAt,
      successRate: this.successCount + this.errorCount > 0
        ? this.successCount / (this.successCount + this.errorCount)
        : 1,
      avgSyncDurationMs: 0,
      totalSynced: this.totalSynced,
      lastSyncCount: 0,
    };
  }

  async sync(since?: Date): Promise<SyncResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    let totalFetched = 0;

    logger.info(`[${this.source}] Starting ${since ? 'incremental' : 'full'} sync`);

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const tenders = await this.fetchTenders(since, page);
        totalFetched += tenders.length;

        if (tenders.length < this.config.batchSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      this.lastSyncAt = new Date();
      this.totalSynced += totalFetched;
      this.successCount++;

      const durationMs = Date.now() - startedAt.getTime();
      logger.info(`[${this.source}] Sync complete: ${totalFetched} fetched in ${durationMs}ms`);

      return {
        source: this.source,
        success: true,
        totalFetched,
        newRecords: totalFetched,
        updatedRecords: 0,
        errorCount: 0,
        durationMs,
        errors: [],
        syncedAt: this.lastSyncAt,
      };
    } catch (err) {
      this.errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[${this.source}] Sync failed: ${msg}`);
      errors.push(msg);

      return {
        source: this.source,
        success: false,
        totalFetched,
        newRecords: 0,
        updatedRecords: 0,
        errorCount: 1,
        durationMs: Date.now() - startedAt.getTime(),
        errors,
        syncedAt: new Date(),
      };
    }
  }
}
