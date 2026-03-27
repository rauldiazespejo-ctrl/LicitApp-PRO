import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const alerts = await db('tender_alerts')
    .where({ user_id: req.user!.sub, tenant_id: req.tenantId })
    .orderBy('created_at', 'desc');
  res.json(alerts);
});

router.post('/', authenticate, [
  body('name').trim().notEmpty(),
  body('keywords').isArray({ min: 1 }),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', details: errors.array() });
    return;
  }

  const id = uuidv4();
  await db('tender_alerts').insert({
    id,
    user_id: req.user!.sub,
    tenant_id: req.tenantId,
    name: req.body.name,
    keywords: JSON.stringify(req.body.keywords ?? []),
    sources: JSON.stringify(req.body.sources ?? []),
    categories: JSON.stringify(req.body.categories ?? []),
    regions: JSON.stringify(req.body.regions ?? []),
    min_budget: req.body.minBudget,
    max_budget: req.body.maxBudget,
    is_active: true,
    notify_via_email: req.body.notifyViaEmail ?? true,
    notify_via_push: req.body.notifyViaPush ?? false,
  });

  res.status(201).json({ id, message: 'Alerta creada exitosamente' });
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  const updated = await db('tender_alerts')
    .where({ id: req.params.id, user_id: req.user!.sub })
    .update({
      name: req.body.name,
      keywords: req.body.keywords ? JSON.stringify(req.body.keywords) : undefined,
      sources: req.body.sources ? JSON.stringify(req.body.sources) : undefined,
      categories: req.body.categories ? JSON.stringify(req.body.categories) : undefined,
      regions: req.body.regions ? JSON.stringify(req.body.regions) : undefined,
      is_active: req.body.isActive,
      updated_at: new Date(),
    });

  if (!updated) {
    res.status(404).json({ error: 'AlertNotFound' });
    return;
  }
  res.json({ message: 'Alerta actualizada' });
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const deleted = await db('tender_alerts')
    .where({ id: req.params.id, user_id: req.user!.sub })
    .delete();

  if (!deleted) {
    res.status(404).json({ error: 'AlertNotFound' });
    return;
  }
  res.json({ message: 'Alerta eliminada' });
});

export default router;
