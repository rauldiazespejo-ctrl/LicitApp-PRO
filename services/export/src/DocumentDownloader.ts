import archiver from 'archiver';
import axios from 'axios';
import { PassThrough } from 'stream';
import { logger } from './config/logger';

interface DocumentEntry {
  name: string;
  url: string;
  tenderTitle: string;
  source: string;
}

export async function downloadDocumentsZip(
  documents: DocumentEntry[],
  onProgress?: (done: number, total: number) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    const passthrough = new PassThrough();
    passthrough.on('data', (c) => chunks.push(c));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);

    archive.pipe(passthrough);

    archive.on('error', (err) => {
      logger.error(`[ZIP] Archive error: ${err.message}`);
      reject(err);
    });

    const tasks = documents.slice(0, 50);
    let completed = 0;

    (async () => {
      for (const doc of tasks) {
        try {
          const safeName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
          const safeSource = doc.source.replace(/[^a-zA-Z0-9]/g, '_');
          const folder = `${safeSource}/${doc.tenderTitle.slice(0, 40).replace(/[^a-zA-Z0-9\s]/g, '_').trim()}`;

          const response = await axios.get(doc.url, {
            responseType: 'stream',
            timeout: 30000,
            headers: { 'User-Agent': 'licitappChile/1.0' },
          });

          archive.append(response.data, { name: `${folder}/${safeName}` });
          completed++;
          onProgress?.(completed, tasks.length);
          logger.debug(`[ZIP] Added document ${completed}/${tasks.length}: ${safeName}`);

          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          logger.warn(`[ZIP] Failed to download ${doc.url}: ${(err as Error).message}`);
          archive.append(`Error descargando: ${doc.url}\n${(err as Error).message}`, {
            name: `errores/${doc.name}_error.txt`,
          });
          completed++;
          onProgress?.(completed, tasks.length);
        }
      }

      await archive.finalize();
    })().catch(reject);
  });
}
