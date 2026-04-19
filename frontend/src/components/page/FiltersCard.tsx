import * as React from 'react';

import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Wraps filter controls and page actions inside a shared card layout.
export function FiltersCard(props: {
  title?: string;
  filters: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const { title = 'Filters', filters, actions, className } = props;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">{filters}</div>

          {actions ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:justify-end">
              <div className="hidden h-6 w-px bg-slate-200 md:block" />
              {actions}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
