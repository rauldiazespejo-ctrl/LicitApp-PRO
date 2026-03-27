import { Client } from '@elastic/elasticsearch';
import { logger } from './logger';

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_USERNAME
    ? { username: process.env.ELASTICSEARCH_USERNAME, password: process.env.ELASTICSEARCH_PASSWORD ?? '' }
    : undefined,
  requestTimeout: 30000,
  maxRetries: 3,
});

export async function connectElasticsearch(): Promise<void> {
  await esClient.ping();
  logger.info('Elasticsearch connected');
}
