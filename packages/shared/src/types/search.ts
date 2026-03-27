export interface SearchQuery {
  query: string;
  filters?: Record<string, unknown>;
  from?: number;
  size?: number;
  sort?: { field: string; order: 'asc' | 'desc' }[];
  aggregations?: string[];
  highlight?: boolean;
}

export interface SearchHit<T = unknown> {
  id: string;
  score?: number;
  source: T;
  highlights?: Record<string, string[]>;
}

export interface SearchResult<T = unknown> {
  hits: SearchHit<T>[];
  total: number;
  took: number;
  aggregations?: Record<string, { buckets: { key: string; doc_count: number }[] }>;
}

export interface IndexConfig {
  name: string;
  settings: Record<string, unknown>;
  mappings: Record<string, unknown>;
}
