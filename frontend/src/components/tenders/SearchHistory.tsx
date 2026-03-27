import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { Clock, Trash2, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  query: string;
  filters: Record<string, unknown> | null;
  result_count: number;
  created_at: string;
}

interface SearchHistoryProps {
  onSelect: (query: string) => void;
}

export function SearchHistory({ onSelect }: SearchHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await apiClient.get<HistoryEntry[]>('/search-history');
      setHistory(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiClient.delete(`/search-history/${id}`);
    setHistory((h) => h.filter((x) => x.id !== id));
  };

  const clearAll = async () => {
    await apiClient.delete('/search-history');
    setHistory([]);
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">Cargando historial...</div>;
  if (history.length === 0) return (
    <div className="p-4 text-sm text-gray-500 text-center">
      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
      Sin historial de búsquedas
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Búsquedas recientes
        </h3>
        <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
          <X className="w-3 h-3" /> Limpiar todo
        </button>
      </div>
      <ul className="divide-y divide-gray-50">
        {history.map((entry) => (
          <li
            key={entry.id}
            onClick={() => onSelect(entry.query)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group"
          >
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{entry.query}</p>
              <p className="text-xs text-gray-400">
                {entry.result_count.toLocaleString('es-CL')} resultados ·{' '}
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
              </p>
            </div>
            <button
              onClick={(e) => remove(entry.id, e)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
