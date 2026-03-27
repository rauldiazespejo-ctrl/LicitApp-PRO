import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { config } from '../config/env';

const router = Router();
const searchClient = axios.create({ baseURL: config.SEARCH_SERVICE_URL, timeout: 15_000 });

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Búsqueda full-text de licitapp con caché Redis
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Términos de búsqueda full-text
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Cursor de paginación profunda (search_after) devuelto en nextCursor
 *       - in: query
 *         name: sources
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: statuses
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: categories
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: regions
 *         schema: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Resultados con facets, highlights y cursor para paginación profunda
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const response = await searchClient.get('/search', {
    params: { ...req.query, tenantId: req.tenantId },
  });
  res.json(response.data);
});

/**
 * @swagger
 * /search/suggestions:
 *   get:
 *     tags: [Search]
 *     summary: Sugerencias de autocompletado (cacheadas 5min)
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 10 }
 */
router.get('/suggestions', authenticate, async (req: Request, res: Response) => {
  const response = await searchClient.get('/search/suggestions', { params: req.query });
  res.json(response.data);
});

/**
 * @swagger
 * /search/reindex:
 *   post:
 *     tags: [Search]
 *     summary: Reindexar licitapp en Elasticsearch e invalidar caché (Admin)
 */
router.post('/reindex', authenticate, async (req: Request, res: Response) => {
  const response = await searchClient.post('/search/reindex', req.body, { timeout: 300_000 });
  res.json(response.data);
});

/**
 * @swagger
 * /search/cache:
 *   delete:
 *     tags: [Search]
 *     summary: Invalidar caché de búsqueda manualmente (Admin)
 */
router.delete('/cache', authenticate, async (_req: Request, res: Response) => {
  const response = await searchClient.delete('/search/cache');
  res.json(response.data);
});

/**
 * @swagger
 * /search/cache/stats:
 *   get:
 *     tags: [Search]
 *     summary: Estadísticas del caché Redis (hits, misses, hit rate)
 */
router.get('/cache/stats', authenticate, async (_req: Request, res: Response) => {
  const response = await searchClient.get('/search/cache/stats');
  res.json(response.data);
});

export default router;
