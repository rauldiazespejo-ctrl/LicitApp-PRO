import express, { Request, Response } from 'express';
import knex from 'knex';
import { exportTendersToExcel } from './ExcelExporter';
import { exportTendersToPDF } from './PdfExporter';
import { downloadDocumentsZip } from './DocumentDownloader';
import { logger } from './config/logger';

const app = express();
app.use(express.json({ limit: '5mb' }));

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'licitapp_chile',
    user: process.env.POSTGRES_USER ?? 'licitapp_user',
    password: process.env.POSTGRES_PASSWORD ?? 'changeme',
  },
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'export' });
});

app.post('/export/excel', async (req: Request, res: Response) => {
  const { filters = {} } = req.body;

  const tenders = await buildTenderQuery(db, filters).limit(10000);
  const parsedTenders = tenders.map(parseTenderRow);

  logger.info(`[EXPORT] Excel: ${parsedTenders.length} tenders`);

  const buffer = await exportTendersToExcel(parsedTenders);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="licitapp_${dateStamp()}.xlsx"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

app.post('/export/pdf', async (req: Request, res: Response) => {
  const { filters = {} } = req.body;

  const tenders = await buildTenderQuery(db, filters).limit(500);
  const parsedTenders = tenders.map(parseTenderRow);

  logger.info(`[EXPORT] PDF: ${parsedTenders.length} tenders`);

  const buffer = await exportTendersToPDF(parsedTenders);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="licitapp_${dateStamp()}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

app.post('/export/documents', async (req: Request, res: Response) => {
  const { tenderIds } = req.body as { tenderIds: string[] };

  if (!Array.isArray(tenderIds) || tenderIds.length === 0) {
    res.status(400).json({ error: 'tenderIds required' });
    return;
  }

  const tenders = await db('tenders')
    .whereIn('id', tenderIds.slice(0, 20))
    .select('id', 'title', 'source', 'documents');

  const documents = tenders.flatMap((t) => {
    const docs = typeof t.documents === 'string' ? JSON.parse(t.documents) : t.documents;
    return (docs ?? []).map((d: any) => ({
      name: d.name ?? d.filename ?? 'documento',
      url: d.url,
      tenderTitle: t.title,
      source: t.source,
    }));
  }).filter((d) => d.url);

  if (!documents.length) {
    res.status(404).json({ error: 'No documents found' });
    return;
  }

  logger.info(`[EXPORT] ZIP: ${documents.length} documents from ${tenders.length} tenders`);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="documentos_${dateStamp()}.zip"`);

  const buffer = await downloadDocumentsZip(documents);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

function buildTenderQuery(db: ReturnType<typeof knex>, filters: any) {
  let q = db('tenders').select('*');
  if (filters.sources?.length) q = q.whereIn('source', filters.sources);
  if (filters.statuses?.length) q = q.whereIn('status', filters.statuses);
  if (filters.categories?.length) q = q.whereIn('category', filters.categories);
  if (filters.publishedAfter) q = q.where('published_at', '>=', new Date(filters.publishedAfter));
  if (filters.publishedBefore) q = q.where('published_at', '<=', new Date(filters.publishedBefore));
  q = q.orderBy('published_at', 'desc');
  return q;
}

function parseTenderRow(row: any) {
  const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : (v ?? []));
  return {
    ...row,
    buyer: parse(row.buyer),
    budget: row.budget ? parse(row.budget) : undefined,
    documents: parse(row.documents),
    contacts: parse(row.contacts),
    requirements: parse(row.requirements),
    tags: parse(row.tags),
    regions: parse(row.regions),
  };
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

const PORT = parseInt(process.env.EXPORT_PORT ?? '3005', 10);
app.listen(PORT, () => logger.info(`Export service running on port ${PORT}`));
