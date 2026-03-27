import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  defaultValue?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ defaultValue = '', onSearch, placeholder = 'Buscar...' }: Props) {
  const [value, setValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(value), 400);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
