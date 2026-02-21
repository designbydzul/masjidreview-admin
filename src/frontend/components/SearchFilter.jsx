import { useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SearchFilter({ searchPlaceholder = 'Cari...', filters = [], searchValue, onSearchChange, filterValues, onFilterChange }) {
  const inputRef = useRef(null);

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      {/* Search input */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3" />
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex h-9 w-full rounded-sm border border-border bg-white pl-8 pr-8 py-2 text-sm transition-colors placeholder:text-text-3 focus:outline-none focus:border-green"
        />
        {searchValue && (
          <button
            onClick={() => { onSearchChange(''); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {filters.map((f) => (
        <select
          key={f.key}
          value={filterValues[f.key] || ''}
          onChange={(e) => onFilterChange(f.key, e.target.value)}
          className={cn(
            'h-9 rounded-sm border border-border bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:border-green sm:w-[160px]',
            !filterValues[f.key] && 'text-text-3'
          )}
        >
          <option value="">{f.allLabel || `Semua ${f.label}`}</option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}

// Hook for search + filter state with debounced search
export function useSearchFilter(debounceMs = 300) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, debounceMs);
  }, [debounceMs]);

  const handleFilterChange = useCallback((key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { search, debouncedSearch, filterValues, handleSearchChange, handleFilterChange };
}
