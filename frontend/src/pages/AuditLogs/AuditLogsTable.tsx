import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ChevronDown, Copy, Eye } from 'lucide-react';
import { formatDate } from '../../utils/format';
import type { AuditLogRow } from '../../api/auditLogs';

function metaPreview(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '-';
  if (typeof value === 'string') return value.length > 60 ? `${value.slice(0, 60)}...` : value;
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value);
      if (!s) return '-';
      return s.length > 60 ? `${s.slice(0, 60)}...` : s;
    } catch {
      return 'View';
    }
  }
  return String(value);
}

export function actorLabel(row: AuditLogRow): string {
  if (row.actor?.email) {
    return row.actor.name ? `${row.actor.email} (${row.actor.name})` : row.actor.email;
  }
  return row.actorUserId || '-';
}

interface AuditLogsTableProps {
  items: AuditLogRow[];
  loading: boolean;
  onOpenView: (row: AuditLogRow) => void;
  onCopyRequestId: (requestId: string) => void;
}

export function AuditLogsTable({
  items,
  loading,
  onOpenView,
  onCopyRequestId,
}: AuditLogsTableProps) {
  const tableHead = (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[190px]">Timestamp</TableHead>
        <TableHead className="w-[170px]">Action</TableHead>
        <TableHead>Actor</TableHead>
        <TableHead>Entity</TableHead>
        <TableHead className="w-[220px]">RequestId</TableHead>
        <TableHead className="w-[220px]">Meta</TableHead>
        <TableHead className="w-[120px] text-right">ACTION</TableHead>
      </TableRow>
    </TableHeader>
  );

  if (loading) {
    return (
      <Table>
        {tableHead}
        <TableBody>
          {Array.from({ length: 8 }).map((_, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-56" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-44" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-44" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Skeleton className="h-8 w-16" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (items.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">No audit logs found.</div>;
  }

  return (
    <Table>
      {tableHead}
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{formatDate(row.createdAt)}</TableCell>
            <TableCell className="font-medium">{row.action}</TableCell>
            <TableCell>{actorLabel(row)}</TableCell>
            <TableCell>
              {row.entityType}
              {row.entityId ? `: ${row.entityId}` : ''}
            </TableCell>
            <TableCell>{row.requestId || '-'}</TableCell>
            <TableCell>
              <span className="block truncate text-slate-500">{metaPreview(row.meta)}</span>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" type="button" className="h-8 px-2">
                    Action <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onOpenView(row)}>
                    <Eye className="mr-2 h-4 w-4" /> View
                  </DropdownMenuItem>
                  {row.requestId ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onCopyRequestId(row.requestId!)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy requestId
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
