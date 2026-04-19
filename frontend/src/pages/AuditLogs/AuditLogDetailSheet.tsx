import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { DetailsSheet } from '../../components/DetailsSheet';
import { formatDate } from '../../utils/format';
import type { AuditLogRow } from '../../api/auditLogs';
import { actorLabel } from './AuditLogsTable';

function safePrettyJson(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function actorRoleFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const record = meta as Record<string, unknown>;
  const actorRole = record.actorRole;
  if (typeof actorRole === 'string' && actorRole.trim()) return actorRole.trim();
  const roleName = record.roleName;
  if (typeof roleName === 'string' && roleName.trim()) return roleName.trim();
  const role = record.role;
  if (typeof role === 'string' && role.trim()) return role.trim();
  const roles = record.roles;
  if (Array.isArray(roles)) {
    const first = roles.find((r) => typeof r === 'string' && r.trim());
    if (typeof first === 'string') return first.trim();
  }
  return undefined;
}

interface AuditLogDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLog: AuditLogRow | null;
  onCopyRequestId: (requestId: string) => void;
}

export function AuditLogDetailSheet({
  open,
  onOpenChange,
  selectedLog,
  onCopyRequestId,
}: AuditLogDetailSheetProps) {
  return (
    <DetailsSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Audit log details"
      description={
        selectedLog
          ? selectedLog.requestId || `${selectedLog.action} • ${formatDate(selectedLog.createdAt)}`
          : undefined
      }
    >
      {!selectedLog ? (
        <div className="text-sm text-slate-500">No audit log selected.</div>
      ) : (
        <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label>Timestamp</Label>
            <div className="text-sm">{formatDate(selectedLog.createdAt)}</div>
          </div>
          <div className="space-y-1">
            <Label>Action</Label>
            <div className="text-sm">{selectedLog.action}</div>
          </div>
          <div className="space-y-1">
            <Label>Actor</Label>
            <div className="text-sm">{actorLabel(selectedLog)}</div>
            {(() => {
              const role = actorRoleFromMeta(selectedLog.meta);
              return role ? <div className="text-xs text-slate-500">Role: {role}</div> : null;
            })()}
          </div>
          <div className="space-y-1">
            <Label>Entity</Label>
            <div className="text-sm">
              <span>{selectedLog.entityType || '—'}</span>
              {selectedLog.entityId ? (
                <span className="text-slate-500"> • {selectedLog.entityId}</span>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Request ID</Label>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-sm">{selectedLog.requestId || '—'}</div>
              {selectedLog.requestId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onCopyRequestId(selectedLog.requestId!)}
                >
                  Copy
                </Button>
              ) : null}
            </div>
          </div>
          {typeof selectedLog.ipAddress !== 'undefined' ? (
            <div className="space-y-1">
              <Label>IP address</Label>
              <div className="text-sm">{selectedLog.ipAddress || '—'}</div>
            </div>
          ) : null}
          {typeof selectedLog.userAgent !== 'undefined' ? (
            <div className="space-y-1">
              <Label>User agent</Label>
              <div className="text-sm break-words">{selectedLog.userAgent || '—'}</div>
            </div>
          ) : null}
          <Separator />
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Meta</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                {safePrettyJson(selectedLog.meta)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </DetailsSheet>
  );
}
