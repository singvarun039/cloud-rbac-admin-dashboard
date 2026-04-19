import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';

export function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading: boolean;
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
          {loading ? <Skeleton className="h-9 w-20" /> : (value ?? '—')}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
