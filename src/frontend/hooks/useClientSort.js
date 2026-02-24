import { useState, useMemo } from 'react';

export default function useClientSort(data) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Nulls/undefined sort to end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let result;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        result = aVal - bVal;
      }
      // Try date comparison (ISO strings)
      else if (typeof aVal === 'string' && typeof bVal === 'string' && /^\d{4}-\d{2}/.test(aVal) && /^\d{4}-\d{2}/.test(bVal)) {
        result = new Date(aVal) - new Date(bVal);
      }
      // String comparison
      else {
        result = String(aVal).localeCompare(String(bVal), 'id', { sensitivity: 'base' });
      }

      return sortConfig.direction === 'desc' ? -result : result;
    });
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
