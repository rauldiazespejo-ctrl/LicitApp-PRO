import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { config } from '../config/env';
import { TenderFilterSchema } from '@licitapp/shared';

const router = Router();

const connectorsClient = axios.create({ baseURL: config.CONNECTORS_SERVICE_URL, timeout: 30000 });
const searchClient = axios.create({ baseURL: config.SEARCH_SERVICE_URL, timeout: 30000 });

/**
 * @swagger
 * /tenders:
 *   get:
 *     tags: [Tenders]
 *     summary: Listar licitapp con filtros
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Búsqueda por texto libre
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
 *       - in: query
 *         name: minBudget
 *         schema: { type: number }
 *       - in: query
 *         name: maxBudget
 *         schema: { type: number }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [publishedAt, closingDate, budget, title, relevance] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Lista paginada de licitapp
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const parsed = TenderFilterSchema.safeParse({
    ...req.query,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
    minBudget: req.query.minBudget ? Number(req.query.minBudget) : undefined,
    maxBudget: req.query.maxBudget ? Number(req.query.maxBudget) : undefined,
    sources: req.query.sources ? (Array.isArray(req.query.sources) ? req.query.sources : [req.query.sources]) : undefined,
    statuses: req.query.statuses ? (Array.isArray(req.query.statuses) ? req.query.statuses : [req.query.statuses]) : undefined,
    categories: req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : undefined,
    regions: req.query.regions ? (Array.isArray(req.query.regions) ? req.query.regions : [req.query.regions]) : undefined,
  });

  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.errors });
    return;
  }

  if (parsed.data.search) {
    const response = await searchClient.get('/tenders/search', {
      params: { ...parsed.data, tenantId: req.tenantId },
    });
    res.json(response.data);
  } else {
    const response = await connectorsClient.get('/tenders', {
      params: { ...parsed.data, tenantId: req.tenantId },
    });
    res.json(response.data);
  }
});

/**
 * @swagger
 * /tenders/{id}:
 *   get:
 *     tags: [Tenders]
 *     summary: Obtener detalle de una licitación
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle de la licitación
 *       404:
 *         description: Licitación no encontrada
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const response = await connectorsClient.get(`/tenders/${req.params.id}`);
  res.json(response.data);
});

/**
 * @swagger
 * /tenders/{id}/save:
 *   post:
 *     tags: [Tenders]
 *     summary: Guardar licitación en favoritos
 */
router.post('/:id/save', authenticate, async (req: Request, res: Response) => {
  const response = await connectorsClient.post(`/tenders/${req.params.id}/save`, {
    userId: req.user!.sub,
    tenantId: req.tenantId,
  });
  res.json(response.data);
});

/**
 * @swagger
 * /tenders/stats:
 *   get:
 *     tags: [Tenders]
 *     summary: Estadísticas agregadas de licitapp
 */
router.get('/stats/summary', authenticate, async (req: Request, res: Response) => {
  const response = await connectorsClient.get('/tenders/stats/summary', {
    params: { tenantId: req.tenantId },
  });
  res.json(response.data);
});

export default router;
