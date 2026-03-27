import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import {
  Tender,
  TenderStatus,
  TenderCategory,
  PortalSource,
  ConnectorConfig,
} from '@licitapp/shared';
import { BaseConnector } from '../../base/BaseConnector';
import { v4 as uuidv4 } from 'uuid';
import { parseFlexibleDate } from '@licitapp/shared';
import { logger } from '../../config/logger';

export class PortalMineroConnector extends BaseConnector {
  readonly source = PortalSource.PORTAL_MINERO;
  private browser: Browser | null = null;

  constructor() {
    const config: ConnectorConfig = {
      source: PortalSource.PORTAL_MINERO,
      enabled: true,
      syncIntervalMinutes: 360,
      batchSize: 50,
      maxRetries: 3,
      retryDelayMs: 3000,
      timeout: 60000,
      rateLimit: { requestsPerMinute: 10, delayBetweenRequestsMs: 6000 },
    };
    super(config);
    this.http.defaults.baseURL = process.env.PORTALMINERO_BASE_URL ?? 'https://www.portalminero.com';
    this.http.defaults.headers['User-Agent'] =
      process.env.PORTALMINERO_USER_AGENT ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.http.get('/');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async fetchTenders(since?: Date, page = 1): Promise<Tender[]> {
    logger.info(`[PORTAL_MINERO] Scraping page ${page}`);

    try {
      const response = await this.throttled(() =>
        this.http.get('/licitapp', {
          params: { pagina: page, orden: 'reciente' },
        })
      );

      const $ = cheerio.load(response.data);
      const tenders: Tender[] = [];

      $('.licitacion-item, .tender-card, article.licitacion').each((_, el) => {
        const tender = this.parseListItem($, $(el));
        if (tender) tenders.push(tender);
      });

      if (tenders.length === 0) {
        return await this.fetchWithPlaywright(page);
      }

      return tenders;
    } catch (err) {
      logger.warn(`[PORTAL_MINERO] Static scraping failed, using Playwright: ${err}`);
      return this.fetchWithPlaywright(page);
    }
  }

  private async fetchWithPlaywright(page: number): Promise<Tender[]> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    }

    const browserPage: Page = await this.browser.newPage();
    const tenders: Tender[] = [];

    try {
      await browserPage.goto(
        `${process.env.PORTALMINERO_BASE_URL}/licitapp?pagina=${page}`,
        { waitUntil: 'networkidle', timeout: 30000 }
      );

      await browserPage.waitForSelector('.licitacion-item, .tender-card, .licitacion-list-item', {
        timeout: 10000,
      }).catch(() => null);

      const html = await browserPage.content();
      const $ = cheerio.load(html);

      $('.licitacion-item, .tender-card, .licitacion-list-item').each((_, el) => {
        const tender = this.parseListItem($, $(el));
        if (tender) tenders.push(tender);
      });
    } finally {
      await browserPage.close();
    }

    return tenders;
  }

  private parseListItem($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): Tender | null {
    try {
      const title = el.find('h2, h3, .titulo, .title').first().text().trim();
      const description = el.find('p, .descripcion, .description').first().text().trim();
      const company = el.find('.empresa, .company, .comprador').first().text().trim();
      const dateText = el.find('.fecha, .date, time').first().text().trim();
      const closingText = el.find('.cierre, .closing').first().text().trim();
      const budgetText = el.find('.presupuesto, .budget, .monto').first().text().trim();
      const externalId = el.attr('data-id') ?? el.find('a').attr('href')?.split('/').pop() ?? uuidv4();

      if (!title) return null;

      const budgetMatch = budgetText.replace(/[^0-9]/g, '');
      const budget = budgetMatch ? parseInt(budgetMatch, 10) : undefined;

      return {
        id: uuidv4(),
        externalId,
        source: PortalSource.PORTAL_MINERO,
        title,
        description,
        status: TenderStatus.OPEN,
        category: TenderCategory.MINING,
        buyer: { name: company || 'Portal Minero', type: 'PRIVATE' },
        budget: budget ? { amount: budget, currency: 'CLP', isEstimate: true } : undefined,
        publishedAt: parseFlexibleDate(dateText),
        closingDate: parseFlexibleDate(closingText),
        documents: [],
        contacts: [],
        requirements: [],
        tags: ['mineria', 'portal-minero'],
        regions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        syncedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    try {
      const response = await this.throttled(() =>
        this.http.get(`/licitapp/${externalId}`)
      );
      const $ = cheerio.load(response.data);
      const title = $('h1').first().text().trim();
      if (!title) return null;

      return {
        id: uuidv4(),
        externalId,
        source: PortalSource.PORTAL_MINERO,
        title,
        description: $('.descripcion-completa, .description-full').text().trim(),
        status: TenderStatus.OPEN,
        category: TenderCategory.MINING,
        buyer: { name: $('.empresa-nombre').text().trim() || 'Portal Minero', type: 'PRIVATE' },
        documents: [],
        contacts: [],
        requirements: [],
        tags: ['mineria'],
        regions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        syncedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  async destroy(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}
