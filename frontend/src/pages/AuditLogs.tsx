import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal";
import { useAuth } from "../auth/useAuth";
import { getApiErrorMessage } from "../api/client";
import {
  getAuditLogs,
  type AuditLogRow,
  type GetAuditLogsParams,
} from "../api/auditLogs";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Separator } from "../components/ui/separator";
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
import { StatsCard } from "../components/page/StatsCard";
import { format } from "date-fns";
import { DatePickerRange, type DateRange } from "../components/ui/date-picker-range";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function parseDateOnly(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Treat as local date, not UTC.
  const d = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function safePrettyJson(value: unknown): string {
  if (value === null || typeof value === "undefined") return "-";
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
  if (value === null || typeof value === "undefined") return "-";
  if (typeof value === "string")
    return value.length > 60 ? `${value.slice(0, 60)}...` : value;
  if (typeof value === "object") {
    try {
      const s = JSON.stringify(value);
      if (!s) return "-";
      return s.length > 60 ? `${s.slice(0, 60)}...` : s;
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
  return row.actorUserId || "-";
}

function NotAuthorized() {
  return (
    <div className="w-full space-y-4">
      <Alert variant="destructive">
        <AlertTitle>Forbidden (403)</AlertTitle>
        <AlertDescription>
          You don't have permission to view audit logs.
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

const DEFAULT_PAGE_SIZE = 10;

export default function AuditLogsPage() {
  const { permissions } = useAuth();
  const canReadAuditLogs = permissions.includes("audit.read");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [actionInput, setActionInput] = useState("ALL");
  const [actorEmailInput, setActorEmailInput] = useState("");
  const [requestIdInput, setRequestIdInput] = useState("");
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");

  const [actorUserIdInput, setActorUserIdInput] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [entityIdInput, setEntityIdInput] = useState("");

  const [actionApplied, setActionApplied] = useState("ALL");
  const [actorEmailApplied, setActorEmailApplied] = useState("");
  const [requestIdApplied, setRequestIdApplied] = useState("");
  const [dateFromApplied, setDateFromApplied] = useState("");
  const [dateToApplied, setDateToApplied] = useState("");
  const [actorUserIdApplied, setActorUserIdApplied] = useState("");
  const [entityTypeApplied, setEntityTypeApplied] = useState("");
  const [entityIdApplied, setEntityIdApplied] = useState("");

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [appliedSeq, setAppliedSeq] = useState(0);

  const selectedRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateOnly(dateFromInput);
    const to = parseDateOnly(dateToInput);
    if (!from && !to) return undefined;
    if (from && to && to < from) return { from: to, to: from };
    return { from, to };
  }, [dateFromInput, dateToInput]);

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
      action: actionApplied,
      actorUserId: actorUserIdApplied,
      actorEmail: actorEmailApplied,
      dateFrom: dateFromApplied || undefined,
      dateTo: dateToApplied || undefined,
      entityType: entityTypeApplied,
      entityId: entityIdApplied,
      requestId: requestIdApplied,
    };
  }, [
    actionApplied,
    actorEmailApplied,
    actorUserIdApplied,
    dateFromApplied,
    dateToApplied,
    entityIdApplied,
    entityTypeApplied,
    limit,
    page,
    requestIdApplied,
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
  }, [canReadAuditLogs, fetchAuditLogs, appliedSeq]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const showingFrom = useMemo(() => {
    if (total === 0) return 0;
    return (page - 1) * limit + 1;
  }, [limit, page, total]);

  const showingTo = useMemo(() => {
    if (total === 0) return 0;
    return Math.min(page * limit, total);
  }, [limit, page, total]);

  const last24hCount = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return items.reduce((acc, row) => {
      const t = Date.parse(row.createdAt);
      if (!Number.isNaN(t) && now - t <= dayMs) return acc + 1;
      return acc;
    }, 0);
  }, [items]);

  const failureCount = useMemo(() => {
    return items.reduce((acc, row) => {
      return row.action.includes("FAILURE") ? acc + 1 : acc;
    }, 0);
  }, [items]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);

    if (page <= 3) {
      start = 2;
      end = 4;
    }
    if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    start = Math.max(2, start);
    end = Math.min(totalPages - 1, end);

    const items: Array<number | "ellipsis"> = [1];
    if (start > 2) items.push("ellipsis");
    for (let p = start; p <= end; p++) items.push(p);
    if (end < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);
    return items;
  }, [page, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRetry = useCallback(() => {
    const controller = new AbortController();
    void fetchAuditLogs({ signal: controller.signal });
  }, [fetchAuditLogs]);

  const onApplyFilters = useCallback(() => {
    setActionApplied(actionInput);
    setActorEmailApplied(actorEmailInput);
    setRequestIdApplied(requestIdInput);
    setDateFromApplied(dateFromInput);
    setDateToApplied(dateToInput);
    setActorUserIdApplied(actorUserIdInput);
    setEntityTypeApplied(entityTypeInput);
    setEntityIdApplied(entityIdInput);
    setPage(1);
    setAppliedSeq((s) => s + 1);
  }, [
    actionInput,
    actorEmailInput,
    actorUserIdInput,
    dateFromInput,
    dateToInput,
    entityIdInput,
    entityTypeInput,
    requestIdInput,
  ]);

  const onResetFilters = useCallback(() => {
    setActionInput("ALL");
    setActorEmailInput("");
    setRequestIdInput("");
    setDateFromInput("");
    setDateToInput("");
    setActorUserIdInput("");
    setEntityTypeInput("");
    setEntityIdInput("");

    setActionApplied("ALL");
    setActorEmailApplied("");
    setRequestIdApplied("");
    setDateFromApplied("");
    setDateToApplied("");
    setActorUserIdApplied("");
    setEntityTypeApplied("");
    setEntityIdApplied("");

    setLimit(DEFAULT_PAGE_SIZE);
    setPage(1);
    setAdvancedOpen(false);
    setAppliedSeq((s) => s + 1);
  }, []);

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
    <div className="w-full space-y-4">
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

      <div className="grid w-full grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Total Events" value={total} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Last 24h" value={last24hCount} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Failures" value={failureCount} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Page Size" value={limit} loading={loading} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
              <Select
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                className="h-10 w-full"
                aria-label="Action"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>

              <Input
                value={actorEmailInput}
                onChange={(e) => setActorEmailInput(e.target.value)}
                placeholder="Actor email"
                aria-label="Actor email"
                type="text"
                className="h-10 w-full placeholder:text-slate-400"
              />

              <DatePickerRange
                value={selectedRange}
                onChange={(range) => {
                  setDateFromInput(
                    range?.from ? format(range.from, "yyyy-MM-dd") : "",
                  );
                  setDateToInput(
                    range?.to ? format(range.to, "yyyy-MM-dd") : "",
                  );
                }}
                placeholder="Pick a date range"
                className="w-full"
              />

              <Input
                value={requestIdInput}
                onChange={(e) => setRequestIdInput(e.target.value)}
                placeholder="Search request ID"
                aria-label="Search request ID"
                type="text"
                className="h-10 w-full placeholder:text-slate-400"
              />
            </div>

            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <Button
                type="button"
                onClick={onApplyFilters}
                disabled={loading}
                className="h-10 w-full sm:w-auto"
              >
                Apply Filters
              </Button>

              <Button
                variant="outline"
                type="button"
                onClick={onResetFilters}
                disabled={loading}
                className="h-10 w-full sm:w-auto"
              >
                Reset Filters
              </Button>

              <Separator orientation="vertical" className="hidden h-10 sm:block" />

              <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    className="h-10 w-full sm:w-auto"
                  >
                    Advanced Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="flex h-full flex-col">
                  <SheetHeader>
                    <SheetTitle>Advanced Filters</SheetTitle>
                    <SheetDescription>
                      Refine audit logs using additional fields.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex-1 space-y-3 overflow-auto pt-4">
                    <Input
                      value={actorUserIdInput}
                      onChange={(e) => setActorUserIdInput(e.target.value)}
                      placeholder="Actor user ID"
                      aria-label="Actor user ID"
                      type="text"
                      className="h-10 w-full placeholder:text-slate-400"
                    />

                    <Input
                      value={entityTypeInput}
                      onChange={(e) => setEntityTypeInput(e.target.value)}
                      placeholder="Entity type"
                      aria-label="Entity type"
                      type="text"
                      className="h-10 w-full placeholder:text-slate-400"
                    />

                    <Input
                      value={entityIdInput}
                      onChange={(e) => setEntityIdInput(e.target.value)}
                      placeholder="Entity ID"
                      aria-label="Entity ID"
                      type="text"
                      className="h-10 w-full placeholder:text-slate-400"
                    />
                  </div>

                  <SheetFooter className="border-t border-slate-200 pt-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        onResetFilters();
                      }}
                      className="h-10"
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        onApplyFilters();
                        setAdvancedOpen(false);
                      }}
                      className="h-10"
                    >
                      Apply Filters
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
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
                  <TableHead className="w-[120px] text-right">ACTION</TableHead>
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
                  <TableHead className="w-[120px] text-right">ACTION</TableHead>
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
                    <TableCell>{row.requestId || "-"}</TableCell>
                    <TableCell>
                      <span className="block truncate text-slate-500">
                        {metaPreview(row.meta)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
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
              Showing {showingFrom}-{showingTo} of {total} events
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <Pagination className="sm:mx-0 sm:w-auto sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (loading || page <= 1) return;
                        setPage((p) => Math.max(1, p - 1));
                      }}
                      className={
                        loading || page <= 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>

                  {paginationItems.map((item, idx) =>
                    item === "ellipsis" ? (
                      <PaginationItem key={`e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === page}
                          onClick={(e) => {
                            e.preventDefault();
                            if (loading) return;
                            setPage(item);
                          }}
                          className={
                            loading ? "pointer-events-none" : undefined
                          }
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (loading || !hasNext) return;
                        setPage((p) => p + 1);
                      }}
                      className={
                        loading || !hasNext
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-slate-600">Page size</Label>
                <Select
                  value={String(limit)}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-10 w-[92px]"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </Select>
              </div>
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
                {selected.requestId || "-"}
              </div>
              {typeof selected.ipAddress !== "undefined" ? (
                <div className="text-slate-600">
                  <span className="font-medium text-slate-900">IP:</span>{" "}
                  {selected.ipAddress || "-"}
                </div>
              ) : null}
              {typeof selected.userAgent !== "undefined" ? (
                <div className="text-slate-600">
                  <span className="font-medium text-slate-900">
                    User-Agent:
                  </span>{" "}
                  {selected.userAgent || "-"}
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
