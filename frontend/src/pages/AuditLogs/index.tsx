import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { getAuditLogs, type AuditLogRow, type GetAuditLogsParams } from '../../api/auditLogs';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { toast } from '../../components/ui/use-toast';
import { NotAuthorized } from '../../components/common/NotAuthorized';
import { PageStatsGrid } from '../../components/common/PageStatsGrid';
import { TablePagination } from '../../components/common/TablePagination';
import { AuditLogsFilters } from './AuditLogsFilters';
import { AuditLogsTable } from './AuditLogsTable';
import { AuditLogDetailSheet } from './AuditLogDetailSheet';
import { isCanceledError } from '../../utils/errors';

const DEFAULT_PAGE_SIZE = 10;

export default function AuditLogsPage() {
  const { permissions } = useAuth();
  const canReadAuditLogs = permissions.includes('audit.read');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [actionInput, setActionInput] = useState('ALL');
  const [actorEmailInput, setActorEmailInput] = useState('');
  const [requestIdInput, setRequestIdInput] = useState('');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [actorUserIdInput, setActorUserIdInput] = useState('');
  const [entityTypeInput, setEntityTypeInput] = useState('');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [actionApplied, setActionApplied] = useState('ALL');
  const [actorEmailApplied, setActorEmailApplied] = useState('');
  const [requestIdApplied, setRequestIdApplied] = useState('');
  const [dateFromApplied, setDateFromApplied] = useState('');
  const [dateToApplied, setDateToApplied] = useState('');
  const [actorUserIdApplied, setActorUserIdApplied] = useState('');
  const [entityTypeApplied, setEntityTypeApplied] = useState('');
  const [entityIdApplied, setEntityIdApplied] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [appliedSeq, setAppliedSeq] = useState(0);
  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const fetchSeqRef = useRef(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);
  const showingFrom = useMemo(
    () => (total === 0 ? 0 : (page - 1) * limit + 1),
    [limit, page, total]
  );
  const showingTo = useMemo(
    () => (total === 0 ? 0 : Math.min(page * limit, total)),
    [limit, page, total]
  );

  const last24hCount = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return items.reduce((acc, row) => {
      const t = Date.parse(row.createdAt);
      return !Number.isNaN(t) && now - t <= dayMs ? acc + 1 : acc;
    }, 0);
  }, [items]);

  const failureCount = useMemo(
    () => items.reduce((acc, row) => (row.action.includes('FAILURE') ? acc + 1 : acc), 0),
    [items]
  );

  const query = useMemo<GetAuditLogsParams>(
    () => ({
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
    }),
    [
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
    ]
  );

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
        setError(getApiErrorMessage(err, 'Failed to load audit logs.'));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadAuditLogs, query]
  );

  useEffect(() => {
    if (!canReadAuditLogs) return;
    const controller = new AbortController();
    void fetchAuditLogs({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadAuditLogs, fetchAuditLogs, appliedSeq]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    setActionInput('ALL');
    setActorEmailInput('');
    setRequestIdInput('');
    setDateFromInput('');
    setDateToInput('');
    setActorUserIdInput('');
    setEntityTypeInput('');
    setEntityIdInput('');
    setActionApplied('ALL');
    setActorEmailApplied('');
    setRequestIdApplied('');
    setDateFromApplied('');
    setDateToApplied('');
    setActorUserIdApplied('');
    setEntityTypeApplied('');
    setEntityIdApplied('');
    setLimit(DEFAULT_PAGE_SIZE);
    setPage(1);
    setAdvancedOpen(false);
    setAppliedSeq((s) => s + 1);
  }, []);

  const onCopyRequestId = useCallback(async (requestId: string) => {
    try {
      await navigator.clipboard.writeText(requestId);
      toast.success('Copied', { description: 'requestId copied to clipboard.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy requestId.' });
    }
  }, []);

  if (!canReadAuditLogs) return <NotAuthorized resource="audit logs" />;

  const stats = [
    { title: 'Total Events', value: total, loading },
    { title: 'Last 24h', value: last24hCount, loading },
    { title: 'Failures', value: failureCount, loading },
    { title: 'Page Size', value: limit, loading },
  ];

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
                onClick={() => void fetchAuditLogs()}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <PageStatsGrid stats={stats} />

      <AuditLogsFilters
        loading={loading}
        actionInput={actionInput}
        setActionInput={setActionInput}
        actorEmailInput={actorEmailInput}
        setActorEmailInput={setActorEmailInput}
        requestIdInput={requestIdInput}
        setRequestIdInput={setRequestIdInput}
        dateFromInput={dateFromInput}
        setDateFromInput={setDateFromInput}
        dateToInput={dateToInput}
        setDateToInput={setDateToInput}
        actorUserIdInput={actorUserIdInput}
        setActorUserIdInput={setActorUserIdInput}
        entityTypeInput={entityTypeInput}
        setEntityTypeInput={setEntityTypeInput}
        entityIdInput={entityIdInput}
        setEntityIdInput={setEntityIdInput}
        advancedOpen={advancedOpen}
        setAdvancedOpen={setAdvancedOpen}
        onApplyFilters={onApplyFilters}
        onResetFilters={onResetFilters}
      />

      <Card className="w-full">
        <CardContent className="pt-6">
          <AuditLogsTable
            items={items}
            loading={loading}
            onOpenView={(row) => {
              setSelectedLog(row);
              setViewOpen(true);
            }}
            onCopyRequestId={(id) => void onCopyRequestId(id)}
          />
          <TablePagination
            page={page}
            totalPages={totalPages}
            hasNext={hasNext}
            limit={limit}
            showingFrom={showingFrom}
            showingTo={showingTo}
            total={total}
            resourceLabel="events"
            loading={loading}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <AuditLogDetailSheet
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setSelectedLog(null);
        }}
        selectedLog={selectedLog}
        onCopyRequestId={(id) => void onCopyRequestId(id)}
      />
    </div>
  );
}
