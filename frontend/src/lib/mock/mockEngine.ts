import { MOCK_TENDERS } from './mockTenders';

export const paginate = (data: any[], page: number, limit: number) => {
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    data: data.slice(start, end),
    total: data.length,
    page,
    totalPages: Math.ceil(data.length / limit),
  };
};

export const filterTenders = (params: any) => {
  let filtered = [...MOCK_TENDERS];

  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.buyer.name.toLowerCase().includes(q) ||
      t.externalId.toLowerCase().includes(q)
    );
  }

  if (params.sources && Array.isArray(params.sources)) {
    filtered = filtered.filter(t => params.sources.includes(t.source));
  }

  if (params.statuses && Array.isArray(params.statuses)) {
    filtered = filtered.filter(t => params.statuses.includes(t.status));
  }

  if (params.regions && Array.isArray(params.regions)) {
    filtered = filtered.filter(t => params.regions.includes(t.buyer.region));
  }

  if (params.minBudget) {
    filtered = filtered.filter(t => (t.budget?.amount || 0) >= Number(params.minBudget));
  }

  if (params.maxBudget) {
    filtered = filtered.filter(t => (t.budget?.amount || 0) <= Number(params.maxBudget));
  }

  // Sorting
  const sortBy = params.sortBy || 'publishedAt';
  const sortOrder = params.sortOrder || 'desc';

  filtered.sort((a: any, b: any) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    if (sortBy === 'publishedAt' || sortBy === 'closingDate') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (sortOrder === 'asc') return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  return paginate(filtered, Number(params.page || 1), Number(params.limit || 20));
};
