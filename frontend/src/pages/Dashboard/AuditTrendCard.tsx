import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';

interface ChartPoint {
  date: string;
  label: string;
  count: number;
}

interface AuditTrendCardProps {
  loading: boolean;
  chartData: ChartPoint[] | null;
  windowDays: number;
}

export function AuditTrendCard({ loading, chartData, windowDays }: AuditTrendCardProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-slate-950">Audit activity trend</CardTitle>
        <CardDescription>Daily audit volume over the last {windowDays} days.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-[320px] w-full rounded-xl" />
          </div>
        ) : chartData === null ? (
          <div className="py-14 text-center text-sm text-slate-500">
            Audit trend is not available.
          </div>
        ) : chartData.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500">
            No audit data in this window.
          </div>
        ) : (
          <div className="h-[320px] rounded-xl border border-slate-200 bg-slate-50 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="audit-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={1} tickLine={false} axisLine={false} />
                <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0f172a"
                  fill="url(#audit-fill)"
                  strokeWidth={2.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
