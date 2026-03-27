import ExcelJS from 'exceljs';
import { Tender } from '@licitapp/shared';

const PORTAL_LABELS: Record<string, string> = {
  CHILECOMPRA: 'ChileCompra', WHEREX: 'Wherex', SAP_ARIBA: 'SAP Ariba',
  SICEP: 'SICEP', COUPA: 'Coupa', PORTAL_MINERO: 'Portal Minero',
};

export async function exportTendersToExcel(tenders: Tender[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'licitapp Chile';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('licitapp', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  sheet.columns = [
    { header: 'ID Externo', key: 'externalId', width: 22 },
    { header: 'Portal', key: 'source', width: 14 },
    { header: 'Título', key: 'title', width: 55 },
    { header: 'Estado', key: 'status', width: 12 },
    { header: 'Categoría', key: 'category', width: 16 },
    { header: 'Organismo Comprador', key: 'buyer', width: 35 },
    { header: 'RUT Comprador', key: 'buyerRut', width: 16 },
    { header: 'Región', key: 'region', width: 20 },
    { header: 'Presupuesto', key: 'budget', width: 18 },
    { header: 'Moneda', key: 'currency', width: 8 },
    { header: 'Fecha Publicación', key: 'publishedAt', width: 20 },
    { header: 'Fecha Cierre', key: 'closingDate', width: 20 },
    { header: 'Fecha Adjudicación', key: 'awardDate', width: 20 },
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Etiquetas', key: 'tags', width: 30 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
  });

  const SOURCE_COLORS: Record<string, string> = {
    CHILECOMPRA: 'FFDBEAFE', WHEREX: 'FFEDE9FE', SAP_ARIBA: 'FFFEF9C3',
    SICEP: 'FFD1FAE5', COUPA: 'FFFEE2E2', PORTAL_MINERO: 'FFF3F4F6',
  };

  tenders.forEach((tender, i) => {
    const row = sheet.addRow({
      externalId: tender.externalId,
      source: PORTAL_LABELS[tender.source] ?? tender.source,
      title: tender.title,
      status: tender.status,
      category: tender.category,
      buyer: tender.buyer.name,
      buyerRut: tender.buyer.rut ?? '',
      region: tender.regions.join(', '),
      budget: tender.budget?.amount ?? '',
      currency: tender.budget?.currency ?? '',
      publishedAt: tender.publishedAt ? new Date(tender.publishedAt).toLocaleDateString('es-CL') : '',
      closingDate: tender.closingDate ? new Date(tender.closingDate).toLocaleDateString('es-CL') : '',
      awardDate: tender.awardDate ? new Date(tender.awardDate).toLocaleDateString('es-CL') : '',
      url: '',
      tags: tender.tags.join(', '),
    });

    const bg = SOURCE_COLORS[tender.source] ?? 'FFFFFFFF';
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? bg : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });

    const budgetCell = row.getCell('budget');
    if (tender.budget?.amount) {
      budgetCell.numFmt = '#,##0';
      budgetCell.value = tender.budget.amount;
    }

    row.height = 18;
  });

  sheet.autoFilter = { from: 'A1', to: 'O1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const statsSheet = workbook.addWorksheet('Estadísticas');
  addStatsSheet(statsSheet, tenders);

  return workbook.xlsx.writeBuffer() as Promise<Buffer>;
}

function addStatsSheet(sheet: ExcelJS.Worksheet, tenders: Tender[]): void {
  sheet.getCell('A1').value = 'Resumen por Portal';
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };

  const bySource = tenders.reduce<Record<string, number>>((acc, t) => {
    acc[t.source] = (acc[t.source] ?? 0) + 1;
    return acc;
  }, {});

  sheet.addRow([]);
  sheet.addRow(['Portal', 'Cantidad', '% del Total']);
  const headerRow = sheet.lastRow!;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  const total = tenders.length;
  for (const [source, count] of Object.entries(bySource)) {
    sheet.addRow([PORTAL_LABELS[source] ?? source, count, `${((count / total) * 100).toFixed(1)}%`]);
  }
  sheet.addRow(['TOTAL', total, '100%']);

  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 14;
}
