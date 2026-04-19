import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { getPermissions, type Permission } from "../api/permissions";
import { replaceRolePermissions, type Role } from "../api/roles";
import { simulateRolePolicyChange, type PolicySimulationResponse } from "../api/policySimulation";
import { getApiErrorMessage } from "../api/client";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";

// Detects whether a request was canceled by the caller.
function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function renderSources(
  sources:
    | Array<{ key: string; label: string; description: string }>
    | undefined,
) {
  if (!sources?.length) {
    return <div className="text-sm text-slate-500">No source metadata.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <span
          key={source.key}
          className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
          title={source.description}
        >
          {source.label}
        </span>
      ))}
    </div>
  );
}

function getPermissionFamily(key: string): string {
  const [family] = key.split(".");
  return family || "other";
}

// Renders the role permission assignment workflow.
export default function AssignPermissionsModal(props: {
  open: boolean;
  role: Role | null;
  canEditRoles: boolean;
  canReadPermissions: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const {
    open,
    role,
    canEditRoles,
    canReadPermissions,
    onClose,
    onSuccess,
    onError,
  } = props;

  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [hydratedFromKeys, setHydratedFromKeys] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<PolicySimulationResponse | null>(
    null,
  );
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);
  const pendingKeysRef = useRef<string[]>([]);
  const hydratedFromKeysRef = useRef(false);
  const simulateSeqRef = useRef(0);

  function extractRolePermissionRefs(input: unknown): {
    ids: string[];
    keys: string[];
  } {
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
      else if (typeof permissionId === "string" && permissionId.trim())
        ids.push(permissionId);

      if (typeof key === "string" && key.trim()) keys.push(key);
    }

    return { ids, keys };
  }

  useEffect(() => {
    if (!open) return;

    setSearch("");
    setCatalog([]);
    setLoading(false);
    setLoadError(null);
    setSubmitting(false);
    setHydratedFromKeys(false);
    setSimulating(false);
    setSimulation(null);
    setSimulationError(null);

    hydratedFromKeysRef.current = false;
    pendingKeysRef.current = [];

    const refs = extractRolePermissionRefs(role?.permissions);
    const uniqIds = Array.from(new Set(refs.ids)).sort();
    const uniqKeys = Array.from(new Set(refs.keys)).sort();

    if (uniqIds.length > 0) {
      setSelectedIds(uniqIds);
      setInitialIds(uniqIds);
      hydratedFromKeysRef.current = true;
      pendingKeysRef.current = [];
    } else if (uniqKeys.length > 0) {
      // If we only have keys, defer mapping until catalog loads.
      setSelectedIds([]);
      setInitialIds([]);
      pendingKeysRef.current = uniqKeys;
    } else {
      setSelectedIds([]);
      setInitialIds([]);
    }
  }, [open, role]);

  useEffect(() => {
    setSimulation(null);
    setSimulationError(null);
  }, [role?.id, selectedIds]);

  useEffect(() => {
    if (!open) return;
    if (!canReadPermissions) return;
    if (hydratedFromKeysRef.current) return;
    if (catalog.length === 0) return;
    if (pendingKeysRef.current.length === 0) return;
    if (selectedIds.length > 0) return;

    const byKey = new Map(catalog.map((p) => [p.key, p.id] as const));
    const mapped = pendingKeysRef.current
      .map((k) => byKey.get(k))
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const uniq = Array.from(new Set(mapped)).sort();
    setSelectedIds(uniq);
    setInitialIds(uniq);

    setHydratedFromKeys(true);

    hydratedFromKeysRef.current = true;
    pendingKeysRef.current = [];
  }, [canReadPermissions, catalog, open, selectedIds.length]);

  const fetchPermissions = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      if (!open) return;
      if (!canReadPermissions) return;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setLoadError(null);

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
    },
    [canReadPermissions, open],
  );

  useEffect(() => {
    if (!open) return;
    if (!canReadPermissions) return;

    const controller = new AbortController();
    void fetchPermissions({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadPermissions, fetchPermissions, open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;

    return catalog.filter((p) => {
      const key = (p.key ?? "").toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      return key.includes(q) || desc.includes(q);
    });
  }, [catalog, search]);

  const selectedPermissions = useMemo(() => {
    const byId = new Map(catalog.map((permission) => [permission.id, permission]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((permission): permission is Permission => Boolean(permission));
  }, [catalog, selectedIds]);

  const changedCount = useMemo(() => {
    const initial = new Set(initialIds);
    return selectedIds.filter((id) => !initial.has(id)).length;
  }, [initialIds, selectedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const hasChanges = useMemo(() => {
    const a = new Set(initialIds);
    const b = new Set(selectedIds);

    if (a.size !== b.size) return true;
    for (const id of a) if (!b.has(id)) return true;
    return false;
  }, [initialIds, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return Array.from(next).sort();
    });
  }, []);

  const onSelectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.add(p.id);
      return Array.from(next).sort();
    });
  }, [filtered]);

  const onClearFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.delete(p.id);
      return Array.from(next).sort();
    });
  }, [filtered]);

  const onRetry = useCallback(() => {
    const controller = new AbortController();
    void fetchPermissions({ signal: controller.signal });
  }, [fetchPermissions]);

  const onSimulate = useCallback(async () => {
    if (!canEditRoles || !role) return;

    const seq = ++simulateSeqRef.current;
    setSimulating(true);
    setSimulationError(null);

    try {
      const res = await simulateRolePolicyChange({
        roleId: role.id,
        permissionIds: selectedIds,
      });
      if (simulateSeqRef.current !== seq) return;
      setSimulation(res);
    } catch (err) {
      if (simulateSeqRef.current !== seq) return;
      setSimulationError(
        err instanceof Error
          ? err.message
          : "Failed to simulate policy impact.",
      );
    } finally {
      if (simulateSeqRef.current === seq) {
        setSimulating(false);
      }
    }
  }, [canEditRoles, role, selectedIds]);

  const onSave = useCallback(async () => {
    if (!canEditRoles || submitting) return;
    if (!role) return;
    if (!canReadPermissions) return;
    if (!hasChanges) return;

    setSubmitting(true);
    try {
      await replaceRolePermissions(role.id, { permissionIds: selectedIds });
      await onSuccess();
    } catch (err) {
      onError(getApiErrorMessage(err, "Failed to update role permissions."));
    } finally {
      setSubmitting(false);
    }
  }, [
    canReadPermissions,
    canEditRoles,
    hasChanges,
    onError,
    onSuccess,
    role,
    selectedIds,
    submitting,
  ]);

  const title = role
    ? `Assign permissions: ${role.name}`
    : "Assign permissions";

  return (
    <Modal
      title={title}
      isOpen={open}
      onClose={onClose}
      contentClassName="max-h-[92vh] max-w-6xl overflow-hidden p-0"
    >
      <div className="flex max-h-[92vh] flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <div className="text-sm text-slate-500">
              Update role access with a denser editor and preview the impact before saving.
            </div>
            {role ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{role.name}</Badge>
                <Badge variant="secondary">Selected: {selectedIds.length}</Badge>
                <Badge variant="secondary">
                  {hasChanges ? "Unsaved changes" : "No pending changes"}
                </Badge>
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
          <CardHeader>
            <CardTitle className="text-base">Forbidden (403)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              You’re not authorized to view permissions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {loadError ? (
            <Alert variant="destructive">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <AlertDescription className="sm:pr-4">
                  {loadError}
                </AlertDescription>
                <Button
                  variant="outline"
                  type="button"
                  onClick={onRetry}
                  className="h-10"
                >
                  Retry
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="grid h-full gap-5 xl:grid-cols-[1.35fr_0.9fr]">
            <Card className="overflow-hidden">
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Permission catalog</CardTitle>
                    <div className="mt-1 text-sm text-slate-500">
                      Filter and toggle permissions for this role.
                    </div>
                  </div>
                  {hydratedFromKeys ? (
                    <Badge variant="secondary">Hydrated from keys</Badge>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="filter by key or description"
                      type="text"
                      disabled={loading || !role}
                      className="h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={onSelectAllFiltered}
                      disabled={loading || filtered.length === 0}
                      className="h-10"
                    >
                      Select visible
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={onClearFiltered}
                      disabled={loading || filtered.length === 0}
                      className="h-10"
                    >
                      Clear visible
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Visible: {filtered.length}</Badge>
                  <Badge variant="secondary">Selected: {selectedIds.length}</Badge>
                  <Badge variant="secondary">
                    Added since open: {changedCount}
                  </Badge>
                </div>

                <div className="max-h-[52vh] overflow-y-auto pr-1">
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : catalog.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      No permissions found.
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      No permissions match your search.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {filtered.map((p) => {
                        const checked = selectedSet.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                              checked
                                ? "border-slate-900 bg-slate-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(p.id)}
                              disabled={!canEditRoles || submitting || !role}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium text-slate-900">
                                  {p.key}
                                </div>
                                <Badge variant="secondary" className="text-[11px]">
                                  {getPermissionFamily(p.key)}
                                </Badge>
                              </div>
                              {p.description ? (
                                <div className="mt-1 text-sm text-slate-600">
                                  {p.description}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Selection summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Selected
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {selectedIds.length}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Initial
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {initialIds.length}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {hasChanges ? "Unsaved changes" : "No changes yet"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Selected permissions
                    </div>
                    <div className="max-h-[20vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {selectedPermissions.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedPermissions.map((permission) => (
                            <Badge key={permission.id} variant="secondary">
                              {permission.key}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          No permissions selected yet.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Policy simulation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onSimulate()}
                      disabled={!role || !canEditRoles || simulating}
                    >
                      {simulating ? "Simulating..." : "Simulate impact"}
                    </Button>
                    <div className="text-sm text-slate-500">
                      Preview what this change removes or unlocks.
                    </div>
                  </div>

                  {simulationError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{simulationError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {simulation ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Summary
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {simulation.summary}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                            Losing access
                          </div>
                          <div className="mt-1 text-lg font-semibold text-red-900">
                            {simulation.impacts.losingAccess.length}
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Gaining access
                          </div>
                          <div className="mt-1 text-lg font-semibold text-emerald-900">
                            {simulation.impacts.gainingAccess.length}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Permission delta
                        </div>
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Removed
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {simulation.removedPermissionKeys.map((key) => (
                                <span
                                  key={key}
                                  className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
                                >
                                  {key}
                                </span>
                              ))}
                              {simulation.removedPermissionKeys.length === 0 ? (
                                <span className="text-sm text-slate-500">None</span>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Added
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {simulation.addedPermissionKeys.map((key) => (
                                <span
                                  key={key}
                                  className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                                >
                                  {key}
                                </span>
                              ))}
                              {simulation.addedPermissionKeys.length === 0 ? (
                                <span className="text-sm text-slate-500">None</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Data sources
                        </div>
                        {renderSources(simulation.sources)}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      Run a simulation to preview the impact of your changes.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
        </div>

      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => void onSimulate()}
          disabled={!role || !canEditRoles || !canReadPermissions || simulating}
        >
          {simulating ? "Simulating..." : "Simulate"}
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={
            !role ||
            !canEditRoles ||
            !canReadPermissions ||
            submitting ||
            !hasChanges
          }
        >
          {submitting ? "Saving…" : "Save"}
        </Button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
