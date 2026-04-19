import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { NotAuthorized } from '../../components/common/NotAuthorized';
import { PageStatsGrid } from '../../components/common/PageStatsGrid';
import { TablePagination } from '../../components/common/TablePagination';
import { AuditLogsFilters } from './AuditLogsFilters';
import { AuditLogsTable } from './AuditLogsTable';
import { AuditLogDetailSheet } from './AuditLogDetailSheet';
import { useAuditLogsPage } from './useAuditLogsPage';

export default function AuditLogsPage() {
  const p = useAuditLogsPage();

  if (!p.canReadAuditLogs) return <NotAuthorized resource="audit logs" />;

  const stats = [
    { title: 'Total Events', value: p.total, loading: p.loading },
    { title: 'Last 24h', value: p.last24hCount, loading: p.loading },
    { title: 'Failures', value: p.failureCount, loading: p.loading },
    { title: 'Page Size', value: p.limit, loading: p.loading },
  ];

  return (
    <div className="w-full space-y-4">
      {p.error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>{p.error}</div>
            <div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void p.fetchAuditLogs()}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <PageStatsGrid stats={stats} />

      <AuditLogsFilters
        loading={p.loading}
        actionInput={p.actionInput}
        setActionInput={p.setActionInput}
        actorEmailInput={p.actorEmailInput}
        setActorEmailInput={p.setActorEmailInput}
        requestIdInput={p.requestIdInput}
        setRequestIdInput={p.setRequestIdInput}
        dateFromInput={p.dateFromInput}
        setDateFromInput={p.setDateFromInput}
        dateToInput={p.dateToInput}
        setDateToInput={p.setDateToInput}
        actorUserIdInput={p.actorUserIdInput}
        setActorUserIdInput={p.setActorUserIdInput}
        entityTypeInput={p.entityTypeInput}
        setEntityTypeInput={p.setEntityTypeInput}
        entityIdInput={p.entityIdInput}
        setEntityIdInput={p.setEntityIdInput}
        advancedOpen={p.advancedOpen}
        setAdvancedOpen={p.setAdvancedOpen}
        onApplyFilters={p.onApplyFilters}
        onResetFilters={p.onResetFilters}
      />

      <Card className="w-full">
        <CardContent className="pt-6">
          <AuditLogsTable
            items={p.items}
            loading={p.loading}
            onOpenView={(row) => {
              p.setSelectedLog(row);
              p.setViewOpen(true);
            }}
            onCopyRequestId={(id) => void p.onCopyRequestId(id)}
          />
          <TablePagination
            page={p.page}
            totalPages={p.totalPages}
            hasNext={p.hasNext}
            limit={p.limit}
            showingFrom={p.showingFrom}
            showingTo={p.showingTo}
            total={p.total}
            resourceLabel="events"
            loading={p.loading}
            onPageChange={p.setPage}
            onLimitChange={(l) => {
              p.setLimit(l);
              p.setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <AuditLogDetailSheet
        open={p.viewOpen}
        onOpenChange={(open) => {
          p.setViewOpen(open);
          if (!open) p.setSelectedLog(null);
        }}
        selectedLog={p.selectedLog}
        onCopyRequestId={(id) => void p.onCopyRequestId(id)}
      />
    </div>
  );
}
