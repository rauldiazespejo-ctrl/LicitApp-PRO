import { MOCK_TENDERS } from './mockTenders';

export const getSummary = () => {
  const bySource = MOCK_TENDERS.reduce((acc: any, t) => {
    acc[t.source] = (acc[t.source] || 0) + 1;
    return acc;
  }, {});

  const byStatus = MOCK_TENDERS.reduce((acc: any, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const closingSoonCount = MOCK_TENDERS.filter(t => {
    if (!t.closingDate) return false;
    const diff = new Date(t.closingDate).getTime() - Date.now();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return {
    total: MOCK_TENDERS.length,
    bySource: Object.entries(bySource).map(([source, count]) => ({ source, count: String(count) })),
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count: String(count) })),
    closingSoon: closingSoonCount
  };
};

export const getTemporal = () => {
  return Array.from({ length: 12 }, (_, i) => ({
    period: new Date(2024, i, 1).toISOString(),
    count: String(100 + Math.floor(Math.random() * 200))
  }));
};

export const getTopBuyers = () => [
  { buyer_name: 'Codelco', tender_count: '45', total_budget: '15000000000' },
  { buyer_name: 'Ministerio de Obras Públicas', tender_count: '32', total_budget: '12000000000' },
  { buyer_name: 'Servicio de Salud Metropolitano', tender_count: '28', total_budget: '5000000000' },
  { buyer_name: 'Municipalidad de Las Condes', tender_count: '22', total_budget: '2500000000' },
  { buyer_name: 'CMPC', tender_count: '18', total_budget: '8000000000' },
  { buyer_name: 'Enel Chile', tender_count: '15', total_budget: '4000000000' },
];

export const getUnspsc = () => [
  { unspsc_code: '43210000', unspsc_label: 'Equipo informático', count: '120' },
  { unspsc_code: '72100000', unspsc_label: 'Servicios de mantenimiento', count: '85' },
  { unspsc_code: '85100000', unspsc_label: 'Servicios de salud', count: '64' },
  { unspsc_code: '46170000', unspsc_label: 'Seguridad y vigilancia', count: '42' },
  { unspsc_code: '26110000', unspsc_label: 'Baterías y generadores', count: '38' },
];

export const getClosingAlerts = () => {
  return MOCK_TENDERS
    .filter(t => {
      if (!t.closingDate) return false;
      const diff = new Date(t.closingDate).getTime() - Date.now();
      return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    })
    .map(t => ({
      id: t.id,
      title: t.title,
      source: t.source,
      closing_date: t.closingDate
    }));
};
