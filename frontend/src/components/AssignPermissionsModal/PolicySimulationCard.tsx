import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SourcesBadges } from "../common/SourcesBadges";
import type { PolicySimulationResponse } from "../../api/policySimulation";

interface PolicySimulationCardProps {
  simulation: PolicySimulationResponse | null;
  simulationError: string | null;
  simulating: boolean;
  canEditRoles: boolean;
  role: { id: string } | null;
  onSimulate: () => void;
}

export function PolicySimulationCard({
  simulation,
  simulationError,
  simulating,
  canEditRoles,
  role,
  onSimulate,
}: PolicySimulationCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Policy simulation</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onSimulate} disabled={!role || !canEditRoles || simulating}>
            {simulating ? "Simulating..." : "Simulate impact"}
          </Button>
          <div className="text-sm text-slate-500">Preview what this change removes or unlocks.</div>
        </div>

        {simulationError ? (
          <Alert variant="destructive"><AlertDescription>{simulationError}</AlertDescription></Alert>
        ) : null}

        {simulation ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{simulation.summary}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Losing access</div>
                <div className="mt-1 text-lg font-semibold text-red-900">{simulation.impacts.losingAccess.length}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Gaining access</div>
                <div className="mt-1 text-lg font-semibold text-emerald-900">{simulation.impacts.gainingAccess.length}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permission delta</div>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Removed</div>
                  <div className="flex flex-wrap gap-2">
                    {simulation.removedPermissionKeys.map((key) => (
                      <span key={key} className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">{key}</span>
                    ))}
                    {simulation.removedPermissionKeys.length === 0 ? <span className="text-sm text-slate-500">None</span> : null}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Added</div>
                  <div className="flex flex-wrap gap-2">
                    {simulation.addedPermissionKeys.map((key) => (
                      <span key={key} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">{key}</span>
                    ))}
                    {simulation.addedPermissionKeys.length === 0 ? <span className="text-sm text-slate-500">None</span> : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data sources</div>
              <SourcesBadges sources={simulation.sources} />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Run a simulation to preview the impact of your changes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
