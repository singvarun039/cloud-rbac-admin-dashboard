import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../Modal";
import { getPermissions, type Permission } from "../../api/permissions";
import { replaceRolePermissions, type Role } from "../../api/roles";
import { simulateRolePolicyChange, type PolicySimulationResponse } from "../../api/policySimulation";
import { getApiErrorMessage } from "../../api/client";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { isCanceledError } from "../../utils/errors";
import { PermissionCatalog } from "./PermissionCatalog";
import { SelectionSummary } from "./SelectionSummary";
import { PolicySimulationCard } from "./PolicySimulationCard";

function extractRolePermissionRefs(input: unknown): { ids: string[]; keys: string[] } {
  const ids: string[] = [];
  const keys: string[] = [];
  if (!Array.isArray(input)) return { ids, keys };
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = record.id;
    const permissionId = record.permissionId;
    const key = record.key;
    if (typeof id === "string" && id.trim()) ids.push(id);
    else if (typeof permissionId === "string" && permissionId.trim()) ids.push(permissionId);
    if (typeof key === "string" && key.trim()) keys.push(key);
  }
  return { ids, keys };
}

export default function AssignPermissionsModal(props: {
  open: boolean;
  role: Role | null;
  canEditRoles: boolean;
  canReadPermissions: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const { open, role, canEditRoles, canReadPermissions, onClose, onSuccess, onError } = props;

  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [hydratedFromKeys, setHydratedFromKeys] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<PolicySimulationResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);
  const pendingKeysRef = useRef<string[]>([]);
  const hydratedFromKeysRef = useRef(false);
  const simulateSeqRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setSearch(""); setCatalog([]); setLoading(false); setLoadError(null);
    setSubmitting(false); setHydratedFromKeys(false); setSimulating(false);
    setSimulation(null); setSimulationError(null);
    hydratedFromKeysRef.current = false; pendingKeysRef.current = [];
    const refs = extractRolePermissionRefs(role?.permissions);
    const uniqIds = Array.from(new Set(refs.ids)).sort();
    const uniqKeys = Array.from(new Set(refs.keys)).sort();
    if (uniqIds.length > 0) {
      setSelectedIds(uniqIds); setInitialIds(uniqIds);
      hydratedFromKeysRef.current = true; pendingKeysRef.current = [];
    } else if (uniqKeys.length > 0) {
      setSelectedIds([]); setInitialIds([]);
      pendingKeysRef.current = uniqKeys;
    } else {
      setSelectedIds([]); setInitialIds([]);
    }
  }, [open, role]);

  useEffect(() => { setSimulation(null); setSimulationError(null); }, [role?.id, selectedIds]);

  useEffect(() => {
    if (!open || !canReadPermissions || hydratedFromKeysRef.current) return;
    if (catalog.length === 0 || pendingKeysRef.current.length === 0 || selectedIds.length > 0) return;
    const byKey = new Map(catalog.map((p) => [p.key, p.id] as const));
    const mapped = pendingKeysRef.current.map((k) => byKey.get(k)).filter((id): id is string => typeof id === "string" && id.length > 0);
    const uniq = Array.from(new Set(mapped)).sort();
    setSelectedIds(uniq); setInitialIds(uniq); setHydratedFromKeys(true);
    hydratedFromKeysRef.current = true; pendingKeysRef.current = [];
  }, [canReadPermissions, catalog, open, selectedIds.length]);

  const fetchPermissions = useCallback(async (opts?: { signal?: AbortSignal }) => {
    if (!open || !canReadPermissions) return;
    const seq = ++fetchSeqRef.current;
    setLoading(true); setLoadError(null);
    try {
      const res = await getPermissions({ signal: opts?.signal });
      if (fetchSeqRef.current !== seq) return;
      setCatalog(res.data);
    } catch (err) {
      if (isCanceledError(err)) return;
      if (fetchSeqRef.current !== seq) return;
      setLoadError(getApiErrorMessage(err, "Failed to load permissions."));
    } finally {
      if (fetchSeqRef.current === seq) setLoading(false);
    }
  }, [canReadPermissions, open]);

  useEffect(() => {
    if (!open || !canReadPermissions) return;
    const controller = new AbortController();
    void fetchPermissions({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadPermissions, fetchPermissions, open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => (p.key ?? "").toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [catalog, search]);

  const selectedPermissions = useMemo(() => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    return selectedIds.map((id) => byId.get(id)).filter((p): p is Permission => Boolean(p));
  }, [catalog, selectedIds]);

  const changedCount = useMemo(() => { const initial = new Set(initialIds); return selectedIds.filter((id) => !initial.has(id)).length; }, [initialIds, selectedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hasChanges = useMemo(() => {
    const a = new Set(initialIds); const b = new Set(selectedIds);
    if (a.size !== b.size) return true;
    for (const id of a) if (!b.has(id)) return true;
    return false;
  }, [initialIds, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return Array.from(next).sort(); });
  }, []);

  const onSelectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => { const next = new Set(prev); for (const p of filtered) next.add(p.id); return Array.from(next).sort(); });
  }, [filtered]);

  const onClearFiltered = useCallback(() => {
    setSelectedIds((prev) => { const next = new Set(prev); for (const p of filtered) next.delete(p.id); return Array.from(next).sort(); });
  }, [filtered]);

  const onSimulate = useCallback(async () => {
    if (!canEditRoles || !role) return;
    const seq = ++simulateSeqRef.current;
    setSimulating(true); setSimulationError(null);
    try {
      const res = await simulateRolePolicyChange({ roleId: role.id, permissionIds: selectedIds });
      if (simulateSeqRef.current !== seq) return;
      setSimulation(res);
    } catch (err) {
      if (simulateSeqRef.current !== seq) return;
      setSimulationError(err instanceof Error ? err.message : "Failed to simulate policy impact.");
    } finally {
      if (simulateSeqRef.current === seq) setSimulating(false);
    }
  }, [canEditRoles, role, selectedIds]);

  const onSave = useCallback(async () => {
    if (!canEditRoles || submitting || !role || !canReadPermissions || !hasChanges) return;
    setSubmitting(true);
    try {
      await replaceRolePermissions(role.id, { permissionIds: selectedIds });
      await onSuccess();
    } catch (err) {
      onError(getApiErrorMessage(err, "Failed to update role permissions."));
    } finally {
      setSubmitting(false);
    }
  }, [canReadPermissions, canEditRoles, hasChanges, onError, onSuccess, role, selectedIds, submitting]);

  const title = role ? `Assign permissions: ${role.name}` : "Assign permissions";

  return (
    <Modal title={title} isOpen={open} onClose={onClose} contentClassName="max-h-[92vh] max-w-6xl overflow-hidden p-0">
      <div className="flex max-h-[92vh] flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <div className="text-sm text-slate-500">Update role access with a denser editor and preview the impact before saving.</div>
            {role ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{role.name}</Badge>
                <Badge variant="secondary">Selected: {selectedIds.length}</Badge>
                <Badge variant="secondary">{hasChanges ? "Unsaved changes" : "No pending changes"}</Badge>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-6 py-5">
          {!role || !canEditRoles ? (
            <div className="space-y-1 text-sm text-slate-500">
              {!role ? <p>No role selected.</p> : null}
              {!canEditRoles ? <p>Requires roles.write or roles.edit.</p> : null}
            </div>
          ) : null}

          {!canReadPermissions ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Forbidden (403)</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">You're not authorized to view permissions.</p></CardContent>
            </Card>
          ) : (
            <>
              {loadError ? (
                <Alert variant="destructive">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <AlertDescription className="sm:pr-4">{loadError}</AlertDescription>
                    <Button variant="outline" type="button" onClick={() => { const c = new AbortController(); void fetchPermissions({ signal: c.signal }); }} className="h-10">Retry</Button>
                  </div>
                </Alert>
              ) : null}

              <div className="grid h-full gap-5 xl:grid-cols-[1.35fr_0.9fr]">
                <PermissionCatalog
                  catalog={catalog} filtered={filtered} loading={loading}
                  search={search} setSearch={setSearch} selectedIds={selectedIds}
                  selectedSet={selectedSet} changedCount={changedCount}
                  hydratedFromKeys={hydratedFromKeys} canEditRoles={canEditRoles}
                  submitting={submitting} role={role} toggle={toggle}
                  onSelectAllFiltered={onSelectAllFiltered} onClearFiltered={onClearFiltered}
                />
                <div className="space-y-5">
                  <SelectionSummary selectedIds={selectedIds} initialIds={initialIds} hasChanges={hasChanges} selectedPermissions={selectedPermissions} />
                  <PolicySimulationCard simulation={simulation} simulationError={simulationError} simulating={simulating} canEditRoles={canEditRoles} role={role} onSimulate={() => void onSimulate()} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="outline" type="button" onClick={() => void onSimulate()} disabled={!role || !canEditRoles || !canReadPermissions || simulating}>
              {simulating ? "Simulating..." : "Simulate"}
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={!role || !canEditRoles || !canReadPermissions || submitting || !hasChanges}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
