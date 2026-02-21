import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border',
  {
    variants: {
      variant: {
        approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        rejected: 'bg-gray-100 text-gray-600 border-gray-200',
        super_admin: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        admin: 'bg-gray-100 text-gray-600 border-gray-200',
      },
    },
    defaultVariants: {
      variant: 'pending',
    },
  }
);

const labels = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  super_admin: 'Super Admin',
  admin: 'Admin',
};

function Badge({ status, className }) {
  return (
    <span className={cn(badgeVariants({ variant: status }), className)}>
      {labels[status] || status}
    </span>
  );
}

export { Badge, badgeVariants };
