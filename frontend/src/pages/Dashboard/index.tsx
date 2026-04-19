import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { AuditTrendCard } from './AuditTrendCard';
import { AssistantCard } from './AssistantCard';
import { AuditInsightsCard } from './AuditInsightsCard';
import { RecentActivityCard } from './RecentActivityCard';
import { KpiCard } from './KpiCard';
import { useDashboardPage } from './useDashboardPage';

export default function DashboardPage() {
  const d = useDashboardPage();

  return (
    <div className="w-full space-y-6 pb-8">
      {d.error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>{d.error}</div>
            <div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void d.loadSummary({ userInitiated: true })}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {d.kpis.map((kpi) => (
          <KpiCard key={kpi.key} label={kpi.label} value={kpi.value} loading={kpi.loading} />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <AuditTrendCard loading={d.loading} chartData={d.chartData} windowDays={d.windowDays} />
          <AssistantCard
            assistantPrompt={d.assistantPrompt}
            setAssistantPrompt={d.setAssistantPrompt}
            assistantAnswer={d.assistantAnswer}
            assistantSources={d.assistantSources}
            assistantError={d.assistantError}
            assistantLoading={d.assistantLoading}
            onSubmit={(p) => void d.submitAssistantPrompt(p)}
            onClear={() => {
              d.setAssistantPrompt('');
              d.setAssistantAnswer('');
              d.setAssistantSources([]);
              d.setAssistantError(null);
            }}
            suggestedPrompts={d.suggestedPrompts}
          />
        </div>

        <div className="space-y-6">
          <AuditInsightsCard
            auditInsights={d.auditInsights}
            auditInsightsLoading={d.auditInsightsLoading}
            auditInsightsError={d.auditInsightsError}
            parsedInsights={d.parsedAuditInsights}
            onRefresh={() => void d.loadAuditInsights({ userInitiated: true })}
          />
          <RecentActivityCard loading={d.loading} recent={d.recent} />
        </div>
      </div>
    </div>
  );
}
