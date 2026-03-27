import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/summary', authenticate, async (req: Request, res: Response) => {
  const { from, to, source } = req.query as Record<string, string>;

  const baseQuery = () => {
    const q = db('tenders').where({ is_duplicate: false });
    if (from) q.where('published_at', '>=', new Date(from));
    if (to) q.where('published_at', '<=', new Date(to));
    if (source) q.where('source', source.toUpperCase());
    return q;
  };

  const [totalRow, bySource, byStatus, closingSoon] = await Promise.all([
    baseQuery().count('id as total').first<{ total: string }>(),

    db('tenders')
      .where({ is_duplicate: false })
      .whereIn('status', ['OPEN', 'PUBLISHED'])
      .groupBy('source')
      .select('source')
      .count('id as count'),

    baseQuery()
      .groupBy('status')
      .select('status')
      .count('id as count'),

    db('tenders')
      .where({ is_duplicate: false })
      .whereIn('status', ['OPEN', 'PUBLISHED'])
      .where('closing_date', '<=', db.raw("NOW() + INTERVAL '7 days'"))
      .where('closing_date', '>', db.raw('NOW()'))
      .count('id as count')
      .first<{ count: string }>(),
  ]);

  res.json({
    total: Number(totalRow?.total ?? 0),
    bySource,
    byStatus,
    closingSoon: Number(closingSoon?.count ?? 0),
  });
});

router.get('/temporal', authenticate, async (req: Request, res: Response) => {
  const { from, to, granularity = 'day', source } = req.query as Record<string, string>;

  const truncMap: Record<string, string> = { day: 'day', week: 'week', month: 'month' };
  const trunc = truncMap[granularity] ?? 'day';

  const q = db('tenders')
    .where({ is_duplicate: false })
    .whereNotNull('published_at')
    .groupByRaw(`DATE_TRUNC('${trunc}', published_at)`)
    .select(db.raw(`DATE_TRUNC('${trunc}', published_at) as period`))
    .count('id as count')
    .orderBy('period', 'asc');

  if (from) q.where('published_at', '>=', new Date(from));
  if (to) q.where('published_at', '<=', new Date(to));
  if (source) q.where('source', source.toUpperCase());

  const rows = await q;
  res.json(rows);
});

router.get('/top-buyers', authenticate, async (req: Request, res: Response) => {
  const { limit = '10', source } = req.query as Record<string, string>;

  const q = db('tenders')
    .where({ is_duplicate: false })
    .whereNotNull('buyer')
    .groupByRaw("buyer->>'name'")
    .select(db.raw("buyer->>'name' as buyer_name"))
    .count('id as tender_count')
    .sum(db.raw("COALESCE((budget->>'amount')::numeric, 0) as total_budget"))
    .orderBy('tender_count', 'desc')
    .limit(Number(limit));

  if (source) q.where('source', source.toUpperCase());

  const rows = await q;
  res.json(rows);
});

router.get('/unspsc', authenticate, async (req: Request, res: Response) => {
  const { from, to } = req.query as Record<string, string>;

  const q = db('tenders')
    .where({ is_duplicate: false })
    .whereNotNull('unspsc_code')
    .groupBy('unspsc_code', 'unspsc_label')
    .select('unspsc_code', 'unspsc_label')
    .count('id as count')
    .sum(db.raw("COALESCE((budget->>'amount')::numeric, 0) as total_budget"))
    .orderBy('count', 'desc');

  if (from) q.where('published_at', '>=', new Date(from));
  if (to) q.where('published_at', '<=', new Date(to));

  const rows = await q;
  res.json(rows);
});

router.get('/closing-alerts', authenticate, async (req: Request, res: Response) => {
  const days = Number((req.query.days as string) ?? 7);

  const rows = await db('tenders')
    .where({ is_duplicate: false })
    .whereIn('status', ['OPEN', 'PUBLISHED'])
    .where('closing_date', '>', db.raw('NOW()'))
    .where('closing_date', '<=', db.raw(`NOW() + INTERVAL '${days} days'`))
    .select('id', 'title', 'source', 'closing_date', 'buyer', 'budget', 'status')
    .orderBy('closing_date', 'asc')
    .limit(100);

  res.json(rows);
});

export default router;
