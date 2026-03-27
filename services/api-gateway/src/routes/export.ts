import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { config } from '../config/env';
import { TenderFilterSchema } from '@licitapp/shared';

const router = Router();
const exportClient = axios.create({ baseURL: process.env.EXPORT_SERVICE_URL ?? 'http://localhost:3005', timeout: 120000 });

router.post('/excel', authenticate, async (req: Request, res: Response) => {
  const response = await exportClient.post('/export/excel', req.body, { responseType: 'arraybuffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', response.headers['content-disposition'] ?? 'attachment; filename="licitapp.xlsx"');
  res.send(Buffer.from(response.data));
});

router.post('/pdf', authenticate, async (req: Request, res: Response) => {
  const response = await exportClient.post('/export/pdf', req.body, { responseType: 'arraybuffer' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', response.headers['content-disposition'] ?? 'attachment; filename="licitapp.pdf"');
  res.send(Buffer.from(response.data));
});

router.post('/documents', authenticate, async (req: Request, res: Response) => {
  const response = await exportClient.post('/export/documents', req.body, { responseType: 'arraybuffer' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', response.headers['content-disposition'] ?? 'attachment; filename="documentos.zip"');
  res.send(Buffer.from(response.data));
});

export default router;
