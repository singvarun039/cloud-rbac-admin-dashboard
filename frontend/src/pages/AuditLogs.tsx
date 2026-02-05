import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal";
import { useAuth } from "../auth/useAuth";
import { getApiErrorMessage } from "../api/client";
import {
  getAuditLogs,
  type AuditLogRow,
  type GetAuditLogsParams,
} from "../api/auditLogs";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function safePrettyJson(value: unknown): string {
  if (value === null || typeof value === "undefined") return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
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

function metaPreview(value: unknown): string {
  if (value === null || typeof value === "undefined") return "—";
  if (typeof value === "string")
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  if (typeof value === "object") {
    try {
      const s = JSON.stringify(value);
      if (!s) return "—";
      return s.length > 60 ? `${s.slice(0, 60)}…` : s;
    } catch {
      return "View";
    }
  }
  return String(value);
}

function actorLabel(row: AuditLogRow): string {
  if (row.actor?.email) {
    return row.actor.name
      ? `${row.actor.email} (${row.actor.name})`
      : row.actor.email;
  }
  return row.actorUserId || "—";
}

function NotAuthorized() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
      </div>

      <Alert variant="destructive">
        <AlertTitle>Forbidden (403)</AlertTitle>
        <AlertDescription>
          You don’t have permission to view audit logs.
        </AlertDescription>
      </Alert>
    </div>
  );
}

const ACTION_OPTIONS = [
  "ALL",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "ROLE_CREATED",
  "ROLE_UPDATED",
  "ROLE_ASSIGNED",
  "ROLE_PERMISSION_UPDATED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_ARCHIVED",
];

export default function AuditLogsPage() {
  const { permissions } = useAuth();
  const canReadAuditLogs = permissions.includes("audit.read");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [action, setAction] = useState("ALL");
  const [actorUserIdInput, setActorUserIdInput] = useState("");
  const [actorEmailInput, setActorEmailInput] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [entityIdInput, setEntityIdInput] = useState("");
  const [requestIdInput, setRequestIdInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const actorUserId = useDebouncedValue(actorUserIdInput, 300);
  const actorEmail = useDebouncedValue(actorEmailInput, 300);
  const entityType = useDebouncedValue(entityTypeInput, 300);
  const entityId = useDebouncedValue(entityIdInput, 300);
  const requestId = useDebouncedValue(requestIdInput, 300);

  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const fetchSeqRef = useRef(0);

  const query = useMemo<GetAuditLogsParams>(() => {
    return {
      page,
      limit,
      action,
      actorUserId,
      actorEmail,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      entityType,
      entityId,
      requestId,
    };
  }, [
    action,
    actorEmail,
    actorUserId,
    dateFrom,
    dateTo,
    entityId,
    entityType,
    limit,
    page,
    requestId,
  ]);

  const fetchAuditLogs = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      if (!canReadAuditLogs) return;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getAuditLogs(query, { signal: opts?.signal });
        if (fetchSeqRef.current !== seq) return;
        setItems(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load audit logs."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadAuditLogs, query],
  );

  useEffect(() => {
    if (!canReadAuditLogs) return;
    const controller = new AbortController();
    void fetchAuditLogs({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadAuditLogs, fetchAuditLogs]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRetry = useCallback(() => {
    const controller = new AbortController();
    void fetchAuditLogs({ signal: controller.signal });
  }, [fetchAuditLogs]);

  const onOpenDetails = useCallback((row: AuditLogRow) => {
    setSelected(row);
    setDetailsOpen(true);
  }, []);

  const onCloseDetails = useCallback(() => {
    setDetailsOpen(false);
    setSelected(null);
  }, []);

  if (!canReadAuditLogs) {
    return <NotAuthorized />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-slate-500">
          Review security-relevant activity across the system.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>{error}</div>
            <div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="h-10"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Actor User ID</Label>
              <Input
                value={actorUserIdInput}
                onChange={(e) => {
                  setActorUserIdInput(e.target.value);
                  setPage(1);
                }}
                placeholder="cuid…"
                type="text"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Actor Email</Label>
              <Input
                value={actorEmailInput}
                onChange={(e) => {
                  setActorEmailInput(e.target.value);
                  setPage(1);
                }}
                placeholder="user@company.com"
                type="text"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>From</Label>
              <Input
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                type="date"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>To</Label>
              <Input
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                type="date"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Input
                value={entityTypeInput}
                onChange={(e) => {
                  setEntityTypeInput(e.target.value);
                  setPage(1);
                }}
                placeholder="User / Role / Project"
                type="text"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Entity ID</Label>
              <Input
                value={entityIdInput}
                onChange={(e) => {
                  setEntityIdInput(e.target.value);
                  setPage(1);
                }}
                placeholder="id…"
                type="text"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Request ID</Label>
              <Input
                value={requestIdInput}
                onChange={(e) => {
                  setRequestIdInput(e.target.value);
                  setPage(1);
                }}
                placeholder="requestId…"
                type="text"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select
                value={String(limit)}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-10"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[190px]">Timestamp</TableHead>
                  <TableHead className="w-[170px]">Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="w-[220px]">RequestId</TableHead>
                  <TableHead className="w-[220px]">Meta</TableHead>
                </TableRow>
              </TableHeader>
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
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No audit logs found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[190px]">Timestamp</TableHead>
                  <TableHead className="w-[170px]">Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="w-[220px]">RequestId</TableHead>
                  <TableHead className="w-[220px]">Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>{actorLabel(row)}</TableCell>
                    <TableCell>
                      {row.entityType}
                      {row.entityId ? `: ${row.entityId}` : ""}
                    </TableCell>
                    <TableCell>{row.requestId || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-slate-500">
                          {metaPreview(row.meta)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => onOpenDetails(row)}
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Total: {total} • Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        title={selected ? `Audit Log ${selected.id}` : "Audit Log"}
        isOpen={detailsOpen}
        onClose={onCloseDetails}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Timestamp:</span>{" "}
                {formatDate(selected.createdAt)}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Action:</span>{" "}
                {selected.action}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Actor:</span>{" "}
                {actorLabel(selected)}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Entity:</span>{" "}
                {selected.entityType}
                {selected.entityId ? `: ${selected.entityId}` : ""}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">RequestId:</span>{" "}
                {selected.requestId || "—"}
              </div>
              {typeof selected.ipAddress !== "undefined" ? (
                <div className="text-slate-600">
                  <span className="font-medium text-slate-900">IP:</span>{" "}
                  {selected.ipAddress || "—"}
                </div>
              ) : null}
              {typeof selected.userAgent !== "undefined" ? (
                <div className="text-slate-600">
                  <span className="font-medium text-slate-900">
                    User-Agent:
                  </span>{" "}
                  {selected.userAgent || "—"}
                </div>
              ) : null}
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Meta</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                  {safePrettyJson(selected.meta)}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
