import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate, authorize } from '../middleware/auth';
import { config } from '../config/env';
import { UserRole } from '@licitapp/shared';

const router = Router();
const connectorsClient = axios.create({ baseURL: config.CONNECTORS_SERVICE_URL, timeout: 60000 });

/**
 * @swagger
 * /connectors:
 *   get:
 *     tags: [Connectors]
 *     summary: Obtener estado de todos los conectores
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const response = await connectorsClient.get('/connectors/health');
  res.json(response.data);
});

/**
 * @swagger
 * /connectors/{source}/sync:
 *   post:
 *     tags: [Connectors]
 *     summary: Disparar sincronización manual de un conector
 *     parameters:
 *       - in: path
 *         name: source
 *         required: true
 *         schema: { type: string }
 */
router.post('/:source/sync', authenticate, authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  const response = await connectorsClient.post(`/connectors/${req.params.source}/sync`, {
    type: req.body.type ?? 'INCREMENTAL',
  });
  res.json(response.data);
});

/**
 * @swagger
 * /connectors/{source}/sync/full:
 *   post:
 *     tags: [Connectors]
 *     summary: Sincronización completa de un conector
 */
router.post('/:source/sync/full', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  const response = await connectorsClient.post(`/connectors/${req.params.source}/sync/full`);
  res.json(response.data);
});

/**
 * @swagger
 * /connectors/jobs:
 *   get:
 *     tags: [Connectors]
 *     summary: Listar jobs de sincronización
 */
router.get('/jobs', authenticate, authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  const response = await connectorsClient.get('/connectors/jobs', { params: req.query });
  res.json(response.data);
});

export default router;
