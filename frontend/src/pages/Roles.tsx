import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getRoles, type Role } from "../api/roles";
import { getApiErrorMessage } from "../api/client";
import RoleModal from "../components/RoleModal";
import AssignPermissionsModal from "../components/AssignPermissionsModal";

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function NotAuthorized() {
  return (
    <div className="page">
      <h1 className="page-title">Roles</h1>
      <div className="card">
        <div className="card-title">Forbidden (403)</div>
        <div className="muted">You don’t have permission to view roles.</div>
      </div>
    </div>
  );
}

function permissionCountLabel(role: Role): string {
  const countFromArray = Array.isArray(role.permissions)
    ? role.permissions.length
    : null;
  const count =
    typeof countFromArray === "number"
      ? countFromArray
      : typeof role.permissionCount === "number"
        ? role.permissionCount
        : 0;
  return `${count} permissions`;
}

export default function RolesPage() {
  const { permissions } = useAuth();

  const canReadRoles = permissions.includes("roles.read");
  const canWriteRoles = permissions.includes("roles.write");
  const canReadPermissions = permissions.includes("permissions.read");

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningRole, setAssigningRole] = useState<Role | null>(null);

  const fetchSeqRef = useRef(0);

  const fetchRoles = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      if (!canReadRoles) return;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getRoles(
          { page: 1, limit: 100, search: debouncedSearch },
          { signal: opts?.signal },
        );
        if (fetchSeqRef.current !== seq) return;
        setRoles(res.data);
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load roles."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadRoles, debouncedSearch],
  );

  useEffect(() => {
    if (!canReadRoles) return;
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadRoles, fetchRoles]);

  const onRetry = useCallback(() => {
    setSuccess(null);
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
  }, [fetchRoles]);

  const onOpenCreate = useCallback(() => {
    setSuccess(null);
    setCreateOpen(true);
  }, []);

  const onOpenEdit = useCallback((r: Role) => {
    setSuccess(null);
    setEditingRole(r);
    setEditOpen(true);
  }, []);

  const onCloseEdit = useCallback(() => {
    setEditOpen(false);
    setEditingRole(null);
  }, []);

  const onOpenAssign = useCallback((r: Role) => {
    setSuccess(null);
    setAssigningRole(r);
    setAssignOpen(true);
  }, []);

  const onCloseAssign = useCallback(() => {
    setAssignOpen(false);
    setAssigningRole(null);
  }, []);

  if (!canReadRoles) {
    return <NotAuthorized />;
  }

  return (
    <div className="page">
      <h1 className="page-title">Roles</h1>
      <div className="muted">Manage roles and their permissions.</div>

      {success ? <div className="alert-success">{success}</div> : null}
      {error ? (
        <div className="alert">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>{error}</div>
            <button className="btn" type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="field">
            <span className="muted">Search</span>
            <input
              className="input"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              placeholder="name or description"
              type="text"
            />
          </label>
        </div>

        {canWriteRoles ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={onOpenCreate}
          >
            Create Role
          </button>
        ) : null}
      </div>

      <div className="card">
        <div className="card-title">Roles</div>

        {loading ? (
          <div className="muted">Loading…</div>
        ) : roles.length === 0 ? (
          <div className="muted">No roles found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Permissions</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    {r.description ? (
                      r.description
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{permissionCountLabel(r)}</td>
                  <td>
                    {canWriteRoles ? (
                      <div className="row-actions">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => onOpenEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => onOpenAssign(r)}
                        >
                          Assign Permissions
                        </button>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RoleModal
        open={createOpen}
        mode="create"
        canWrite={canWriteRoles}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          await fetchRoles();
          setSuccess("Role created.");
        }}
        onError={(msg) => setError(msg)}
      />

      <RoleModal
        open={editOpen}
        mode="edit"
        initialRole={editingRole}
        canWrite={canWriteRoles}
        onClose={onCloseEdit}
        onSuccess={async () => {
          onCloseEdit();
          await fetchRoles();
          setSuccess("Role updated.");
        }}
        onError={(msg) => setError(msg)}
      />

      <AssignPermissionsModal
        open={assignOpen}
        role={assigningRole}
        canWriteRoles={canWriteRoles}
        canReadPermissions={canReadPermissions}
        onClose={onCloseAssign}
        onSuccess={async () => {
          onCloseAssign();
          await fetchRoles();
          setSuccess("Role permissions updated.");
        }}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
