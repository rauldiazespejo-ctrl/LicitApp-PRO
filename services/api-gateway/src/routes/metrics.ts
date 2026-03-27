import { Router, Request, Response } from 'express';
import { registry } from '../config/metrics';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

export default router;
