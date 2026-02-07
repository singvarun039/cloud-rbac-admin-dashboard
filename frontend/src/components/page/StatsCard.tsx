import * as React from "react";

import { cn } from "../../lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function StatsCard(props: {
  title: string;
  value: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const { title, value, loading = false, className } = props;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="space-y-1">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {loading ? <Skeleton className="h-7 w-24" /> : value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
