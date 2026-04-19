import * as React from 'react';

import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Wraps table content inside a shared card layout.
export function TableCard(props: {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  const { title, children, className, headerRight } = props;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader
        className={cn(
          'py-3',
          headerRight ? 'flex flex-row items-center justify-between gap-3' : ''
        )}
      >
        <CardTitle className="text-base">{title}</CardTitle>
        {headerRight ? <div>{headerRight}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
