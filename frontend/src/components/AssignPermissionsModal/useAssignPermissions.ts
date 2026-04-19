import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPermissions, type Permission } from "../../api/permissions";
import { replaceRolePermissions, type Role } from "../../api/roles";
import { simulateRolePolicyChange, type PolicySimulationResponse } from "../../api/policySimulation";
import { getApiErrorMessage } from "../../api/client";
import { isCanceledError } from "../../utils/errors";

function extractRolePermissionRefs(input: unknown): { ids: string[]; keys: string[] } {
  const ids: string[] = [];
  const keys: string[] = [];
  if (!Array.isArray(input)) return { ids, keys };
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = record.id; const permissionId = record.permissionId; const key = record.key;
    if (typeof id === "string" && id.trim()) ids.push(id);
    else if (typeof permissionId === "string" && permissionId.trim()) ids.push(permissionId);
    if (typeof key === "string" && key.trim()) keys.push(key);
  }
  return { ids, keys };
}

export function useAssignPermissions(props: {
  open: boolean;
  role: Role | null;
  canEditRoles: boolean;
  canReadPermissions: boolean;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const { open, role, canEditRoles, canReadPermissions, onSuccess, onError } = props;

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
      setSelectedIds([]); setInitialIds([]); pendingKeysRef.current = uniqKeys;
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

  const changedCount = useMemo(() => { const s = new Set(initialIds); return selectedIds.filter((id) => !s.has(id)).length; }, [initialIds, selectedIds]);
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

  return {
    search, setSearch, catalog, loading, loadError,
    selectedIds, hydratedFromKeys, submitting, simulating, simulation, simulationError,
    filtered, selectedPermissions, changedCount, selectedSet, hasChanges,
    fetchPermissions, toggle, onSelectAllFiltered, onClearFiltered, onSimulate, onSave,
  };
}
