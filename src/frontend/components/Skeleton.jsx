import { cn } from '../lib/utils';

function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-sm bg-bg-2', className)} />;
}

function SkeletonTablePage({ columns = 5, rows = 6, hasFilterTabs, hasButton }) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-7 w-40" />
        {hasButton && <Skeleton className="h-9 w-36 rounded-md" />}
      </div>

      {/* Filter tabs */}
      {hasFilterTabs && (
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      )}

      {/* Search bar + filter dropdown */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Skeleton className="h-9 flex-1 rounded-sm" />
        <Skeleton className="h-9 w-full sm:w-[160px] rounded-sm" />
      </div>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        {/* Table header */}
        <div className="border-b border-border bg-bg px-4 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1 max-w-[100px]" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className={cn('px-4 py-3.5 flex gap-4 items-center', rowIdx < rows - 1 && 'border-b border-border/50')}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={colIdx} className={cn('h-3.5 flex-1', colIdx === 0 ? 'max-w-[140px]' : 'max-w-[100px]')} />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div>
      <Skeleton className="h-7 w-32 mb-5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-border rounded-sm p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonFormPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-7 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Form card */}
      <div className="border border-border rounded-sm p-6 mb-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3.5 w-20 mb-2" />
              <Skeleton className="h-9 w-full rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonDetailPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      {/* Info card */}
      <div className="border border-border rounded-sm p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-14 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Reviews section */}
      <Skeleton className="h-5 w-48 mb-3" />
      <div className="border border-border rounded-sm overflow-hidden">
        <div className="border-b border-border bg-bg px-4 py-3 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1 max-w-[100px]" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, rowIdx) => (
          <div key={rowIdx} className={cn('px-4 py-3.5 flex gap-4 items-center', rowIdx < 2 && 'border-b border-border/50')}>
            {Array.from({ length: 5 }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-3.5 flex-1 max-w-[100px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton, SkeletonTablePage, SkeletonDashboard, SkeletonFormPage, SkeletonDetailPage };
