import { Badge } from '../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { formatDate } from '../../utils/format';

interface RecentAuditRow {
  id: string;
  action: string;
  actorEmail?: string | null;
  actorUserId?: string | null;
  createdAt: string;
}

interface RecentActivityCardProps {
  loading: boolean;
  recent: RecentAuditRow[] | null;
}

export function RecentActivityCard({ loading, recent }: RecentActivityCardProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-slate-950">Recent activity</CardTitle>
        <CardDescription>Latest 5 audit events</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : recent === null ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Recent activity is not available.
          </div>
        ) : recent.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No recent activity.</div>
        ) : (
          <div className="rounded-xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="secondary">{row.action}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {row.actorEmail || row.actorUserId || '—'}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {formatDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
