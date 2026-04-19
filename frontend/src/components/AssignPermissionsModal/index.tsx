import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import type { Role } from '../../api/roles';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { PermissionCatalog } from './PermissionCatalog';
import { SelectionSummary } from './SelectionSummary';
import { PolicySimulationCard } from './PolicySimulationCard';
import { useAssignPermissions } from './useAssignPermissions';

export default function AssignPermissionsModal(props: {
  open: boolean;
  role: Role | null;
  canEditRoles: boolean;
  canReadPermissions: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const { open, role, canEditRoles, canReadPermissions, onClose } = props;
  const m = useAssignPermissions(props);
  const title = role ? `Assign permissions: ${role.name}` : 'Assign permissions';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      {/* h-[92vh] gives flex-1 a concrete parent height so the footer is always visible */}
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col overflow-hidden p-0">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex-none border-b border-slate-200 pl-6 pr-12 pt-5 pb-4">
          <DialogTitle className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </DialogTitle>
          <p className="mt-1 text-sm text-slate-500">
            Update role access with a denser editor and preview the impact before saving.
          </p>
          {role ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{role.name}</Badge>
              <Badge variant="secondary">Selected: {m.selectedIds.length}</Badge>
              <Badge variant="secondary">
                {m.hasChanges ? 'Unsaved changes' : 'No pending changes'}
              </Badge>
            </div>
          ) : null}
        </div>

        {/* ── Scrollable content ──────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
          {!role || !canEditRoles ? (
            <div className="space-y-1 text-sm text-slate-500">
              {!role ? <p>No role selected.</p> : null}
              {!canEditRoles ? <p>Requires roles.write or roles.edit.</p> : null}
            </div>
          ) : null}
          {!canReadPermissions ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Forbidden (403)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">You're not authorized to view permissions.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {m.loadError ? (
                <Alert variant="destructive" className="mb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <AlertDescription className="sm:pr-4">{m.loadError}</AlertDescription>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const c = new AbortController();
                        void m.fetchPermissions({ signal: c.signal });
                      }}
                      className="h-10"
                    >
                      Retry
                    </Button>
                  </div>
                </Alert>
              ) : null}
              <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1.35fr_0.9fr]">
                <PermissionCatalog
                  catalog={m.catalog}
                  filtered={m.filtered}
                  loading={m.loading}
                  search={m.search}
                  setSearch={m.setSearch}
                  selectedIds={m.selectedIds}
                  selectedSet={m.selectedSet}
                  changedCount={m.changedCount}
                  hydratedFromKeys={m.hydratedFromKeys}
                  canEditRoles={canEditRoles}
                  submitting={m.submitting}
                  role={role}
                  toggle={m.toggle}
                  onSelectAllFiltered={m.onSelectAllFiltered}
                  onClearFiltered={m.onClearFiltered}
                />
                <div className="space-y-5 overflow-y-auto">
                  <SelectionSummary
                    selectedIds={m.selectedIds}
                    initialIds={[]}
                    hasChanges={m.hasChanges}
                    selectedPermissions={m.selectedPermissions}
                  />
                  <PolicySimulationCard
                    simulation={m.simulation}
                    simulationError={m.simulationError}
                    simulating={m.simulating}
                    canEditRoles={canEditRoles}
                    role={role}
                    onSimulate={() => void m.onSimulate()}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer (always visible) ──────────────────────────────── */}
        <div className="flex-none border-t border-slate-200 px-6 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void m.onSimulate()}
              disabled={!role || !canEditRoles || !canReadPermissions || m.simulating}
            >
              {m.simulating ? 'Simulating...' : 'Simulate'}
            </Button>
            <Button
              type="button"
              onClick={() => void m.onSave()}
              disabled={
                !role || !canEditRoles || !canReadPermissions || m.submitting || !m.hasChanges
              }
            >
              {m.submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
