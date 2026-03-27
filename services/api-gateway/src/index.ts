import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';

import { config } from './config/env';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { setupMetrics } from './config/metrics';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { tenantMiddleware } from './middleware/tenant';
import { auditMiddleware } from './middleware/auditLog';
import { securityHeaders, sanitizeInput, validateContentType } from './middleware/security/securityHeaders';
import { apiKeyMiddleware } from './middleware/apiKey';
import { setupSwagger } from './config/swagger';

import authRouter from './routes/auth';
import tendersRouter from './routes/tenders';
import connectorsRouter from './routes/connectors';
import searchRouter from './routes/search';
import alertsRouter from './routes/alerts';
import usersRouter from './routes/users';
import analyticsRouter from './routes/analytics';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import exportRouter from './routes/export';
import searchHistoryRouter from './routes/searchHistory';
import companyProfileRouter from './routes/companyProfile';

const app = express();

app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(helmet({ contentSecurityPolicy: false, hsts: false }));
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID', 'X-API-Key'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(validateContentType);
app.use(sanitizeInput);
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(requestId);
app.use(auditMiddleware);

setupSwagger(app);

app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);

app.use(rateLimiter);

app.use('/api/v1/auth', authRouter);
app.use(apiKeyMiddleware);
app.use('/api/v1/tenders', tenantMiddleware, tendersRouter);
app.use('/api/v1/connectors', tenantMiddleware, connectorsRouter);
app.use('/api/v1/search', tenantMiddleware, searchRouter);
app.use('/api/v1/alerts', tenantMiddleware, alertsRouter);
app.use('/api/v1/users', tenantMiddleware, usersRouter);
app.use('/api/v1/analytics', tenantMiddleware, analyticsRouter);
app.use('/api/v1/export', tenantMiddleware, exportRouter);
app.use('/api/v1/search-history', tenantMiddleware, searchHistoryRouter);
app.use('/api/v1/company-profile', tenantMiddleware, companyProfileRouter);

app.use(errorHandler);

const server = createServer(app);

async function bootstrap() {
  try {
    await connectDatabase();
    logger.info('PostgreSQL connected');

    await connectRedis();
    logger.info('Redis connected');

    setupMetrics();

    server.listen(config.PORT, config.HOST, () => {
      logger.info(`API Gateway running on http://${config.HOST}:${config.PORT}`);
      logger.info(`Swagger docs: http://${config.HOST}:${config.PORT}/api-docs`);
    });
  } catch (err) {
    logger.error('Failed to bootstrap API Gateway', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => { logger.info('HTTP server closed'); process.exit(0); });
});

bootstrap();
export { app };
