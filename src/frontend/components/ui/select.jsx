import * as React from 'react';
import { cn } from '../../lib/utils';

const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        'flex h-9 w-full appearance-none rounded-sm border border-border bg-white pl-3 pr-9 py-2 text-sm transition-colors focus:outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      style={{
        backgroundImage: CHEVRON_SVG,
        backgroundPosition: 'right 0.625rem center',
        backgroundSize: '16px 16px',
        backgroundRepeat: 'no-repeat',
      }}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export { Select };
