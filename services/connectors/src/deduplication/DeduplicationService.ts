import crypto from 'crypto';
import { Tender, PortalSource } from '@licitapp/shared';
import { db } from '../config/database';
import { logger } from '../config/logger';

export interface DuplicateMatch {
  id: string;
  externalId: string;
  source: PortalSource;
  similarity: number;
  fingerprint: string;
}

interface CandidateRow {
  id: string;
  external_id: string;
  source: PortalSource;
  title: string;
  published_at: Date | null;
  buyer: Record<string, unknown>;
  budget: Record<string, unknown> | null;
  closing_date: Date | null;
  fingerprint: string | null;
}

export class DeduplicationService {
  static readonly SIMILARITY_THRESHOLD = 0.85;
  private static readonly TITLE_WEIGHT  = 0.50;
  private static readonly BUYER_WEIGHT  = 0.30;
  private static readonly BUDGET_WEIGHT = 0.10;
  private static readonly DATE_WEIGHT   = 0.10;

  // ─── Fingerprint & hash ───────────────────────────────────────────────────

  static computeFingerprint(tender: Tender): string {
    const normalized = [
      tender.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
      (tender.buyer?.rut ?? tender.buyer?.name ?? '').toLowerCase().replace(/\s+/g, ''),
      tender.budget?.amount != null ? Math.round(tender.budget.amount / 1000).toString() : '',
      tender.closingDate ? new Date(tender.closingDate).toISOString().split('T')[0] : '',
    ].join('|');

    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }

  static computeContentHash(tender: Tender): string {
    const content = JSON.stringify({
      title: tender.title,
      description: tender.description?.slice(0, 500),
      externalId: tender.externalId,
      source: tender.source,
    });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // ─── Similarity scoring ───────────────────────────────────────────────────

  static titleSimilarity(a: string, b: string): number {
    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/licitaci[oó]n\s*(p[uú]blica)?\s*n[°º]?\s*[\d\-/]+/gi, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1.0;

    const tokensA = new Set(na.split(' ').filter((t) => t.length > 3));
    const tokensB = new Set(nb.split(' ').filter((t) => t.length > 3));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    return intersection / union;
  }

  static computeSimilarityScore(a: Partial<CandidateRow> & { title: string }, b: CandidateRow): number {
    let score = 0;

    score += this.titleSimilarity(a.title, b.title) * this.TITLE_WEIGHT;

    const buyerA = (a.buyer as Record<string, string>)?.rut ?? (a.buyer as Record<string, string>)?.name ?? '';
    const buyerB = (b.buyer as Record<string, string>)?.rut ?? (b.buyer as Record<string, string>)?.name ?? '';
    if (buyerA && buyerB) {
      const buyerMatch = buyerA === buyerB
        ? 1.0
        : this.titleSimilarity(
            (a.buyer as Record<string, string>)?.name ?? '',
            (b.buyer as Record<string, string>)?.name ?? '',
          );
      score += buyerMatch * this.BUYER_WEIGHT;
    }

    const amountA = (a.budget as Record<string, number>)?.amount;
    const amountB = (b.budget as Record<string, number>)?.amount;
    if (amountA && amountB) {
      const diff = Math.abs(amountA - amountB) / Math.max(amountA, amountB);
      score += (1 - Math.min(diff, 1)) * this.BUDGET_WEIGHT;
    }

    const dateA = a.closing_date ? new Date(a.closing_date).getTime() : null;
    const dateB = b.closing_date ? new Date(b.closing_date).getTime() : null;
    if (dateA && dateB) {
      const diffDays = Math.abs(dateA - dateB) / 86_400_000;
      score += (diffDays <= 7 ? 1.0 : diffDays <= 30 ? 0.5 : 0) * this.DATE_WEIGHT;
    }

    return parseFloat(score.toFixed(4));
  }

  // ─── Find duplicates ──────────────────────────────────────────────────────

  async findDuplicates(tender: Tender): Promise<DuplicateMatch[]> {
    const fingerprint = DeduplicationService.computeFingerprint(tender);

    // 1. Exact fingerprint match (different source)
    const exactMatches = await db('tenders')
      .select('id', 'external_id', 'source', 'fingerprint')
      .where('fingerprint', fingerprint)
      .whereNot('source', tender.source)
      .whereNot(function () {
        if (tender.id) this.where('id', tender.id);
      });

    if (exactMatches.length > 0) {
      logger.debug(`[DEDUP] Exact fingerprint match for ${tender.externalId}: ${exactMatches.length} found`);
      return exactMatches.map((m) => ({
        id: m.id,
        externalId: m.external_id,
        source: m.source,
        similarity: 1.0,
        fingerprint: m.fingerprint ?? fingerprint,
      }));
    }

    // 2. pg_trgm similarity search (requires pg_trgm extension)
    const normalizedTitle = tender.title
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let candidates: CandidateRow[] = [];
    try {
      candidates = await db.raw<{ rows: CandidateRow[] }>(
        `SELECT id, external_id, source, title, published_at, buyer, budget, closing_date, fingerprint
         FROM tenders
         WHERE source != ?
           AND is_duplicate = false
           AND similarity(lower(title), ?) > 0.3
         ORDER BY similarity(lower(title), ?) DESC
         LIMIT 30`,
        [tender.source, normalizedTitle, normalizedTitle],
      ).then((r) => r.rows);
    } catch {
      // Fallback: ILIKE with first significant token
      const tokens = normalizedTitle.split(/\s+/).filter((t) => t.length > 4).slice(0, 3);
      if (tokens.length === 0) return [];
      candidates = await db('tenders')
        .select('id', 'external_id', 'source', 'title', 'published_at', 'buyer', 'budget', 'closing_date', 'fingerprint')
        .where(function () {
          tokens.forEach((tok, i) => {
            if (i === 0) this.whereRaw('title ILIKE ?', [`%${tok}%`]);
            else this.orWhereRaw('title ILIKE ?', [`%${tok}%`]);
          });
        })
        .whereNot('source', tender.source)
        .where('is_duplicate', false)
        .limit(30);
    }

    if (candidates.length === 0) return [];

    const tenderProxy = {
      title: tender.title,
      buyer: tender.buyer as unknown as Record<string, unknown>,
      budget: tender.budget as unknown as Record<string, unknown>,
      closing_date: tender.closingDate ?? null,
    };

    const matches: DuplicateMatch[] = [];

    for (const candidate of candidates) {
      const score = DeduplicationService.computeSimilarityScore(
        tenderProxy as Parameters<typeof DeduplicationService.computeSimilarityScore>[0],
        candidate,
      );
      if (score >= DeduplicationService.SIMILARITY_THRESHOLD) {
        logger.info(
          `[DEDUP] Score ${score} for ${tender.externalId}(${tender.source}) ↔ ${candidate.external_id}(${candidate.source})`,
        );
        matches.push({
          id: candidate.id,
          externalId: candidate.external_id,
          source: candidate.source,
          similarity: score,
          fingerprint: candidate.fingerprint ?? fingerprint,
        });
      }
    }

    return matches;
  }

  // ─── Record duplicates in DB ──────────────────────────────────────────────

  async recordDuplicateGroup(masterId: string, matches: DuplicateMatch[]): Promise<void> {
    if (!matches.length) return;

    const records = matches.map((m) => ({
      master_id: masterId,
      duplicate_id: m.id,
      similarity: m.similarity,
      fingerprint: m.fingerprint,
      detected_at: new Date(),
    }));

    await db('tender_duplicates')
      .insert(records)
      .onConflict(['master_id', 'duplicate_id'])
      .merge(['similarity', 'detected_at']);

    // Mark duplicate tenders in the tenders table
    const duplicateIds = matches.map((m) => m.id);
    await db('tenders')
      .whereIn('id', duplicateIds)
      .update({ is_duplicate: true, master_id: masterId, updated_at: new Date() });

    logger.debug(`[DEDUP] Marked ${duplicateIds.length} tenders as duplicates of ${masterId}`);
  }

  // ─── Bulk re-deduplication ────────────────────────────────────────────────

  /**
   * Full re-dedup pass over all non-duplicate tenders (batch by batch).
   * Used by the DeduplicationWorker for the periodic bulk job.
   */
  async bulkDeduplicate(
    batchSize = 200,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ totalChecked: number; newDuplicates: number }> {
    const total: number = await db('tenders')
      .where('is_duplicate', false)
      .count('id as cnt')
      .first<{ cnt: string }>()
      .then((r) => Number(r?.cnt ?? 0));

    let offset = 0;
    let totalChecked = 0;
    let newDuplicates = 0;

    while (offset < total) {
      const batch = await db('tenders')
        .select('id', 'external_id', 'source', 'title', 'description', 'buyer', 'budget', 'closing_date', 'fingerprint', 'category')
        .where('is_duplicate', false)
        .orderBy('created_at', 'asc')
        .limit(batchSize)
        .offset(offset);

      for (const row of batch) {
        const tender: Partial<Tender> = {
          id: row.id,
          externalId: row.external_id,
          source: row.source,
          title: row.title,
          description: row.description,
          buyer: row.buyer,
          budget: row.budget,
          closingDate: row.closing_date,
          category: row.category,
        };

        const matches = await this.findDuplicates(tender as Tender);
        if (matches.length > 0) {
          await this.recordDuplicateGroup(row.id, matches);
          newDuplicates += matches.length;
        }
      }

      totalChecked += batch.length;
      offset += batchSize;
      onProgress?.(totalChecked, total);
    }

    return { totalChecked, newDuplicates };
  }
}

export const deduplicationService = new DeduplicationService();
