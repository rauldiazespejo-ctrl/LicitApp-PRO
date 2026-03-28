import { create } from 'zustand';

interface TenderFilter {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  sources?: string[];
  statuses?: string[];
  categories?: string[];
  regions?: string[];
  minBudget?: number;
  maxBudget?: number;
}

interface TenderFilterState {
  filters: Partial<TenderFilter>;
  setFilters: (filters: Partial<TenderFilter>) => void;
  resetFilters: () => void;
  updateFilter: <K extends keyof TenderFilter>(key: K, value: TenderFilter[K]) => void;
}

export const useTenderFilterStore = create<TenderFilterState>((set) => ({
  filters: { page: 1, limit: 20, sortBy: 'publishedAt', sortOrder: 'desc' },
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  resetFilters: () => set({ filters: { page: 1, limit: 20, sortBy: 'publishedAt', sortOrder: 'desc' } }),
  updateFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value, page: 1 } })),
}));
