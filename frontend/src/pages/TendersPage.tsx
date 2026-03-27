import { useState, useCallback } from 'react';
import { useTenders } from '@/hooks/useTenders';
import { useTenderFilterStore } from '@/stores/tenderFilterStore';
import TenderCard from '@/components/tenders/TenderCard';
import TenderFilters from '@/components/filters/TenderFilters';
import SearchBar from '@/components/tenders/SearchBar';
import Pagination from '@/components/ui/Pagination';
import { SlidersHorizontal, Loader2, AlertCircle } from 'lucide-react';

export default function TendersPage() {
  const { filters, setFilters, updateFilter } = useTenderFilterStore();
  const [showFilters, setShowFilters] = useState(false);
  const { data, isLoading, isError, error } = useTenders(filters);

  const handleSearch = useCallback((q: string) => {
    setFilters({ ...filters, search: q, page: 1 });
  }, [filters, setFilters]);

  const handlePageChange = useCallback((page: number) => {
    updateFilter('page', page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateFilter]);

  return (
    <div className="flex h-full">
      {showFilters && (
        <aside className="w-72 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex-shrink-0">
          <TenderFilters onClose={() => setShowFilters(false)} />
        </aside>
      )}

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">licitapp</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
                {data ? `${data.total.toLocaleString('es-CL')} resultados` : 'Buscando...'}
              </p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
            </button>
          </div>

          <SearchBar
            defaultValue={filters.search ?? ''}
            onSearch={handleSearch}
            placeholder="Buscar licitapp por título, organismo, código..."
          />

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">Error al cargar licitapp: {(error as any)?.message}</span>
            </div>
          )}

          {!isLoading && !isError && data?.data.length === 0 && (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">No se encontraron licitapp</p>
              <p className="text-sm mt-1">Intenta cambiar los filtros o términos de búsqueda</p>
            </div>
          )}

          {!isLoading && data && data.data.length > 0 && (
            <>
              <div className="space-y-3">
                {data.data.map((tender) => (
                  <TenderCard key={tender.id} tender={tender} />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
