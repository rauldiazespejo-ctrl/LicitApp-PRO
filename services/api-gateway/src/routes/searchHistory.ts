import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const history = await db('search_history')
    .where({ user_id: req.user!.sub })
    .orderBy('created_at', 'desc')
    .limit(50)
    .select('id', 'query', 'filters', 'result_count', 'created_at');
  res.json(history);
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  const { query, filters, resultCount } = req.body;
  if (!query?.trim()) {
    res.status(400).json({ error: 'QueryRequired' });
    return;
  }

  await db('search_history').insert({
    id: uuidv4(),
    user_id: req.user!.sub,
    tenant_id: req.tenantId,
    query: query.trim(),
    filters: filters ? JSON.stringify(filters) : null,
    result_count: resultCount ?? 0,
    created_at: new Date(),
  });

  res.status(201).json({ ok: true });
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await db('search_history').where({ id: req.params.id, user_id: req.user!.sub }).delete();
  res.json({ ok: true });
});

router.delete('/', authenticate, async (req: Request, res: Response) => {
  await db('search_history').where({ user_id: req.user!.sub }).delete();
  res.json({ ok: true, message: 'Historial eliminado' });
});

export default router;
