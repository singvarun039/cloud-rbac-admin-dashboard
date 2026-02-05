import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { getPermissions, type Permission } from "../api/permissions";
import { replaceRolePermissions, type Role } from "../api/roles";
import { getApiErrorMessage } from "../api/client";

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
      {!role ? <div className="muted">No role selected.</div> : null}
      {!canWriteRoles ? (
        <div className="muted">Requires roles.write.</div>
      ) : null}

      {!canReadPermissions ? (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="card-title">Forbidden (403)</div>
          <div className="muted">
            You’re not authorized to view permissions.
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <div className="toolbar-left">
              <label className="field">
                <span className="muted">Search</span>
                <input
                  className="input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="filter by key or description"
                  type="text"
                  disabled={loading || !role}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                type="button"
                onClick={onSelectAllFiltered}
                disabled={loading || filtered.length === 0}
              >
                Select all filtered
              </button>
              <button
                className="btn"
                type="button"
                onClick={onClearFiltered}
                disabled={loading || filtered.length === 0}
              >
                Clear filtered
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="alert">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>{loadError}</div>
                <button className="btn" type="button" onClick={onRetry}>
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 10 }}>
            <div className="card-title">Permissions</div>

            {loading ? (
              <div className="muted">Loading…</div>
            ) : catalog.length === 0 ? (
              <div className="muted">No permissions found.</div>
            ) : filtered.length === 0 ? (
              <div className="muted">No permissions match your search.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {filtered.map((p) => {
                  const checked = selectedSet.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className="muted"
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        disabled={!canWriteRoles || submitting || !role}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--text, inherit)",
                          }}
                        >
                          {p.key}
                        </div>
                        {p.description ? (
                          <div className="muted" style={{ fontSize: 13 }}>
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

          <div className="muted" style={{ marginTop: 10 }}>
            Selected: {selectedIds.length}
          </div>
          {hydratedFromKeys ? (
            <div className="muted" style={{ marginTop: 4 }}>
              Hydrated from keys
            </div>
          ) : null}
        </>
      )}

      <div className="modal-actions">
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
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
        </button>
      </div>
    </Modal>
  );
}
