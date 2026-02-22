import { useState, useMemo, useCallback, useEffect } from 'react';

const PAGE_SIZE = 20;

export default function usePagination(filteredData, deps = []) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when any filter dependency changes
  useEffect(() => {
    setCurrentPage(1);
  }, deps);

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, safePage]);

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  return { currentPage: safePage, totalItems, totalPages, pageSize: PAGE_SIZE, paginatedData, goToPage };
}
