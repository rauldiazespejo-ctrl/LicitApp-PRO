import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { Tender } from '@licitapp/shared';

const PORTAL_LABELS: Record<string, string> = {
  CHILECOMPRA: 'ChileCompra', WHEREX: 'Wherex', SAP_ARIBA: 'SAP Ariba',
  SICEP: 'SICEP', COUPA: 'Coupa', PORTAL_MINERO: 'Portal Minero',
};

export async function exportTendersToPDF(tenders: Tender[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'licitapp Chile - Reporte',
        Author: 'Sistema Unificado de licitapp Chile',
        Subject: `Reporte de ${tenders.length} licitapp`,
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    drawHeader(doc, tenders.length);

    drawSummaryStats(doc, tenders);

    doc.addPage();
    drawTenderList(doc, tenders);

    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, count: number): void {
  doc.rect(0, 0, doc.page.width, 120).fill('#1e40af');
  doc.fillColor('white').fontSize(24).font('Helvetica-Bold')
    .text('licitapp Chile', 50, 35);
  doc.fontSize(13).font('Helvetica')
    .text('Sistema Unificado de licitapp', 50, 65);
  doc.fontSize(11)
    .text(`Reporte generado: ${new Date().toLocaleString('es-CL')} — ${count} licitapp`, 50, 88);
  doc.fillColor('black').moveDown(2);
}

function drawSummaryStats(doc: PDFKit.PDFDocument, tenders: Tender[]): void {
  const y = 140;
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e40af')
    .text('Resumen Ejecutivo', 50, y);

  doc.moveTo(50, y + 20).lineTo(doc.page.width - 50, y + 20)
    .strokeColor('#bfdbfe').lineWidth(1).stroke();

  const bySource = tenders.reduce<Record<string, number>>((acc, t) => {
    acc[t.source] = (acc[t.source] ?? 0) + 1;
    return acc;
  }, {});

  const byStatus = tenders.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalBudget = tenders.reduce((sum, t) => sum + (t.budget?.amount ?? 0), 0);

  doc.fontSize(11).font('Helvetica').fillColor('#374151');
  let lineY = y + 35;

  doc.font('Helvetica-Bold').text('Por Portal:', 50, lineY);
  lineY += 18;
  for (const [source, count] of Object.entries(bySource)) {
    doc.font('Helvetica').text(`  ${PORTAL_LABELS[source] ?? source}: ${count}`, 50, lineY);
    lineY += 16;
  }

  lineY += 10;
  doc.font('Helvetica-Bold').text('Por Estado:', 50, lineY);
  lineY += 18;
  for (const [status, count] of Object.entries(byStatus)) {
    doc.font('Helvetica').text(`  ${status}: ${count}`, 50, lineY);
    lineY += 16;
  }

  if (totalBudget > 0) {
    lineY += 10;
    doc.font('Helvetica-Bold').text('Presupuesto Total Estimado:', 50, lineY);
    lineY += 18;
    doc.font('Helvetica').fillColor('#065f46')
      .text(`  CLP ${totalBudget.toLocaleString('es-CL')}`, 50, lineY);
  }
}

function drawTenderList(doc: PDFKit.PDFDocument, tenders: Tender[]): void {
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e40af')
    .text('Detalle de licitapp', 50, 50);

  let y = 90;
  const pageHeight = doc.page.height - 70;

  tenders.forEach((tender, i) => {
    if (y > pageHeight - 140) {
      doc.addPage();
      y = 50;
    }

    doc.rect(50, y, doc.page.width - 100, 1).fill('#e2e8f0');
    y += 8;

    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text(`#${i + 1} · ${PORTAL_LABELS[tender.source] ?? tender.source} · ${tender.status} · ${tender.category}`, 50, y);
    y += 14;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text(tender.title.slice(0, 120) + (tender.title.length > 120 ? '...' : ''), 50, y, { width: doc.page.width - 100 });
    y += 18;

    doc.fontSize(9).font('Helvetica').fillColor('#374151')
      .text(`Comprador: ${tender.buyer.name}`, 50, y);
    y += 13;

    const meta: string[] = [];
    if (tender.budget?.amount) meta.push(`Presupuesto: CLP ${tender.budget.amount.toLocaleString('es-CL')}`);
    if (tender.closingDate) meta.push(`Cierre: ${new Date(tender.closingDate).toLocaleDateString('es-CL')}`);
    if (tender.regions.length) meta.push(`Regiones: ${tender.regions.slice(0, 2).join(', ')}`);

    if (meta.length) {
      doc.fontSize(9).fillColor('#6b7280').text(meta.join(' · '), 50, y);
      y += 13;
    }

    y += 10;
  });
}
