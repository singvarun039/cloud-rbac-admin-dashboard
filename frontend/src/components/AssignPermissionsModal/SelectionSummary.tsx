import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { Permission } from "../../api/permissions";

interface SelectionSummaryProps {
  selectedIds: string[];
  initialIds: string[];
  hasChanges: boolean;
  selectedPermissions: Permission[];
}

export function SelectionSummary({ selectedIds, initialIds, hasChanges, selectedPermissions }: SelectionSummaryProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Selection summary</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{selectedIds.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Initial</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{initialIds.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{hasChanges ? "Unsaved changes" : "No changes yet"}</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected permissions</div>
          <div className="max-h-[20vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            {selectedPermissions.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedPermissions.map((p) => <Badge key={p.id} variant="secondary">{p.key}</Badge>)}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No permissions selected yet.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
