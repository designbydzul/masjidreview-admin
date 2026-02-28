import * as React from 'react';
import { cn } from '../../lib/utils';

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="overflow-auto max-h-[calc(100vh-260px)] min-h-[320px] bg-white rounded-card border border-border">
    <table ref={ref} className={cn('w-full text-sm caption-bottom', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-b border-border-2 transition-colors hover:bg-bg/50', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'text-left px-4 py-3 text-[11px] font-semibold text-text-3 uppercase tracking-wider bg-bg border-b border-border sticky top-0 z-10',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-4 py-3 text-text', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
