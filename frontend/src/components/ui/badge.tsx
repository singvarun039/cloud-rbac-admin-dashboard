import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-slate-200 bg-slate-50 text-slate-900',
        secondary: 'border-slate-200 bg-slate-100 text-slate-900',
        success: 'border-green-200 bg-green-50 text-green-700',
        destructive: 'border-red-200 bg-red-50 text-red-700',
        outline: 'border-slate-200 bg-white text-slate-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

// Renders a styled status or metadata badge.
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
