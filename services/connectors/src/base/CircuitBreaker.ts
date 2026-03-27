import { logger } from '../config/logger';
import { PortalSource } from '@licitapp/shared';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitorInterval: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000,
  monitorInterval: 10_000,
};

export class CircuitBreaker {
  private readonly states = new Map<PortalSource, CircuitBreakerState>();
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getState(source: PortalSource): CircuitBreakerState {
    if (!this.states.has(source)) {
      this.states.set(source, { state: CircuitState.CLOSED, failures: 0, successes: 0 });
    }
    return this.states.get(source)!;
  }

  isOpen(source: PortalSource): boolean {
    const s = this.getState(source);
    if (s.state === CircuitState.OPEN) {
      if (Date.now() >= (s.nextAttemptTime ?? 0)) {
        s.state = CircuitState.HALF_OPEN;
        s.successes = 0;
        logger.info(`[CB] ${source} -> HALF_OPEN (allowing probe request)`);
      } else {
        return true;
      }
    }
    return false;
  }

  async execute<T>(source: PortalSource, fn: () => Promise<T>): Promise<T> {
    if (this.isOpen(source)) {
      const s = this.getState(source);
      const waitSec = Math.ceil(((s.nextAttemptTime ?? Date.now()) - Date.now()) / 1000);
      throw new CircuitOpenError(source, waitSec);
    }

    try {
      const result = await fn();
      this.onSuccess(source);
      return result;
    } catch (err) {
      this.onFailure(source, err as Error);
      throw err;
    }
  }

  private onSuccess(source: PortalSource): void {
    const s = this.getState(source);
    if (s.state === CircuitState.HALF_OPEN) {
      s.successes++;
      if (s.successes >= this.options.successThreshold) {
        s.state = CircuitState.CLOSED;
        s.failures = 0;
        s.successes = 0;
        logger.info(`[CB] ${source} -> CLOSED (recovered after ${s.successes} successes)`);
      }
    } else {
      s.failures = Math.max(0, s.failures - 1);
    }
  }

  private onFailure(source: PortalSource, err: Error): void {
    const s = this.getState(source);
    s.failures++;
    s.lastFailureTime = Date.now();

    logger.warn(`[CB] ${source} failure ${s.failures}/${this.options.failureThreshold}: ${err.message}`);

    if (s.failures >= this.options.failureThreshold || s.state === CircuitState.HALF_OPEN) {
      s.state = CircuitState.OPEN;
      s.nextAttemptTime = Date.now() + this.options.timeout;
      logger.error(`[CB] ${source} -> OPEN (will retry at ${new Date(s.nextAttemptTime).toISOString()})`);
    }
  }

  getStatus(source: PortalSource): CircuitBreakerState {
    return { ...this.getState(source) };
  }

  getAllStatuses(): Record<string, CircuitBreakerState> {
    const result: Record<string, CircuitBreakerState> = {};
    for (const [source, state] of this.states) {
      result[source] = { ...state };
    }
    return result;
  }

  reset(source: PortalSource): void {
    this.states.set(source, { state: CircuitState.CLOSED, failures: 0, successes: 0 });
    logger.info(`[CB] ${source} manually reset to CLOSED`);
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly source: PortalSource, public readonly retryAfterSeconds: number) {
    super(`Circuit breaker OPEN for ${source}. Retry after ${retryAfterSeconds}s`);
    this.name = 'CircuitOpenError';
  }
}

export const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 120_000,
});
