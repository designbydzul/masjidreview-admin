import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { cn } from '../lib/utils';

export default function DataTable({ columns, data, selectable, selectedIds, onSelectionChange, emptyIcon: EmptyIcon, emptyText = 'Tidak ada data', sortConfig, onSort }) {
  const allIds = data.map((row) => row.id);
  const allSelected = selectable && data.length > 0 && allIds.every((id) => selectedIds?.has(id));
  const someSelected = selectable && data.length > 0 && allIds.some((id) => selectedIds?.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected || someSelected) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(allIds));
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex justify-center mb-3">
          {EmptyIcon ? <EmptyIcon className="h-10 w-10 text-text-3" /> : null}
        </div>
        <p className="text-text-3 text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-10 px-3">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
              />
            </TableHead>
          )}
          {columns.map((col) => (
            <TableHead key={col.key}>
              {col.sortable && onSort ? (
                <button
                  onClick={() => onSort(col.key)}
                  className={cn(
                    'flex items-center gap-1 uppercase text-[11px] font-semibold tracking-wider transition-colors',
                    sortConfig?.key === col.key ? 'text-green' : 'text-text-3 hover:text-text-2'
                  )}
                >
                  {col.label}
                  {sortConfig?.key === col.key && (
                    <span className="text-[9px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                  )}
                </button>
              ) : (
                col.label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            {selectable && (
              <TableCell className="w-10 px-3">
                <Checkbox
                  checked={selectedIds?.has(row.id) || false}
                  onCheckedChange={() => toggleOne(row.id)}
                />
              </TableCell>
            )}
            {columns.map((col) => (
              <TableCell key={col.key}>
                {col.render ? col.render(row) : row[col.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
