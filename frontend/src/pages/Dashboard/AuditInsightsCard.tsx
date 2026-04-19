import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { SourcesBadges } from '../../components/common/SourcesBadges';
import type { AuditInsightsResponse } from '../../api/auditInsights';

interface InsightBlock {
  summary: string | null;
  anomalies: string[];
  recommendations: string[];
}

function InsightSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="section-label">{title}</div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${title}-${item}`} className="content-item">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}

interface AuditInsightsCardProps {
  auditInsights: AuditInsightsResponse | null;
  auditInsightsLoading: boolean;
  auditInsightsError: string | null;
  parsedInsights: InsightBlock;
  onRefresh: () => void;
}

export function AuditInsightsCard({
  auditInsights,
  auditInsightsLoading,
  auditInsightsError,
  parsedInsights,
  onRefresh,
}: AuditInsightsCardProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg text-slate-950">Audit anomaly insights</CardTitle>
          <CardDescription>Concise AI review of recent audit behavior.</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={auditInsightsLoading}
        >
          {auditInsightsLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {auditInsightsError ? (
          <Alert variant="destructive">
            <AlertTitle>Insights unavailable</AlertTitle>
            <AlertDescription>{auditInsightsError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Total events
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">
              {auditInsightsLoading && !auditInsights
                ? '...'
                : (auditInsights?.analytics.totalEvents ?? '—')}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Failures
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">
              {auditInsightsLoading && !auditInsights
                ? '...'
                : (auditInsights?.analytics.totalFailures ?? '—')}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="section-label">Summary</div>
          <div className="content-box">
            {auditInsightsLoading && !auditInsights ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : parsedInsights.summary ? (
              parsedInsights.summary
            ) : (
              'No summary available yet.'
            )}
          </div>
        </div>

        <InsightSection
          title="Anomalies"
          items={parsedInsights.anomalies}
          emptyText="No clear anomaly beyond normal variation."
        />
        <InsightSection
          title="Recommendations"
          items={parsedInsights.recommendations}
          emptyText="No follow-up recommendations yet."
        />

        <Separator />

        <div className="space-y-2">
          <div className="section-label">Top actions</div>
          <div className="flex flex-wrap gap-2">
            {(auditInsights?.analytics.topActions ?? []).slice(0, 4).map((item) => (
              <Badge key={item.action} variant="secondary">
                {item.action}: {item.count}
              </Badge>
            ))}
            {!auditInsights?.analytics.topActions?.length && !auditInsightsLoading ? (
              <span className="text-sm text-slate-500">Not available.</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="section-label">Data sources</div>
          <SourcesBadges sources={auditInsights?.sources} />
        </div>
      </CardContent>
    </Card>
  );
}
