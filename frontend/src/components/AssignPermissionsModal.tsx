import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { getPermissions, type Permission } from "../api/permissions";
import { replaceRolePermissions, type Role } from "../api/roles";
import { getApiErrorMessage } from "../api/client";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

export default function AssignPermissionsModal(props: {
  open: boolean;
  role: Role | null;
  canWriteRoles: boolean;
  canReadPermissions: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const {
    open,
    role,
    canWriteRoles,
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

  const fetchSeqRef = useRef(0);
  const pendingKeysRef = useRef<string[]>([]);
  const hydratedFromKeysRef = useRef(false);

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

  const onSave = useCallback(async () => {
    if (!canWriteRoles || submitting) return;
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
    canWriteRoles,
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
    <Modal title={title} isOpen={open} onClose={onClose}>
      {!role || !canWriteRoles ? (
        <div className="space-y-1 text-sm text-slate-500">
          {!role ? <p>No role selected.</p> : null}
          {!canWriteRoles ? <p>Requires roles.write.</p> : null}
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={onSelectAllFiltered}
                disabled={loading || filtered.length === 0}
                className="h-10"
              >
                Select all filtered
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={onClearFiltered}
                disabled={loading || filtered.length === 0}
                className="h-10"
              >
                Clear filtered
              </Button>
            </div>
          </div>

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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
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
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(p.id)}
                          disabled={!canWriteRoles || submitting || !role}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {p.key}
                          </div>
                          {p.description ? (
                            <div className="mt-0.5 text-sm text-slate-600">
                              {p.description}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-sm text-slate-500">
            Selected: {selectedIds.length}
          </div>
          {hydratedFromKeys ? (
            <div className="-mt-2 text-sm text-slate-500">
              Hydrated from keys
            </div>
          ) : null}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={
            !role ||
            !canWriteRoles ||
            !canReadPermissions ||
            submitting ||
            !hasChanges
          }
        >
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
