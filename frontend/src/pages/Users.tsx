import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal";
import { useAuth } from "../auth/useAuth";
import { getApiErrorMessage } from "../api/client";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type User,
  type UserStatus,
} from "../api/users";

type StatusFilter = "ALL" | UserStatus;

function isConflictError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 409;
}

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function NotAuthorized() {
  return (
    <div className="page">
      <h1 className="page-title">Users</h1>
      <div className="card">
        <div className="card-title">Forbidden (403)</div>
        <div className="muted">You don’t have permission to view users.</div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { permissions } = useAuth();

  const canReadUsers = permissions.includes("users.read");
  const canWriteUsers = permissions.includes("users.write");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchSeqRef = useRef(0);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const fetchUsers = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      if (!canReadUsers) return;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getUsers(
          {
            page,
            limit,
            search,
            status,
          },
          { signal: opts?.signal },
        );

        if (fetchSeqRef.current !== seq) return;
        setUsers(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load users."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadUsers, limit, page, search, status],
  );

  useEffect(() => {
    if (!canReadUsers) return;
    const controller = new AbortController();
    void fetchUsers({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadUsers, fetchUsers]);

  useEffect(() => {
    // Keep page within range if total shrinks.
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRetry = useCallback(() => {
    setSuccess(null);
    const controller = new AbortController();
    void fetchUsers({ signal: controller.signal });
  }, [fetchUsers]);

  const onOpenCreate = useCallback(() => {
    setSuccess(null);
    setCreateOpen(true);
  }, []);

  const onOpenEdit = useCallback((u: User) => {
    setSuccess(null);
    setEditingUser(u);
    setEditOpen(true);
  }, []);

  const onCloseEdit = useCallback(() => {
    setEditOpen(false);
    setEditingUser(null);
  }, []);

  const onDelete = useCallback(
    async (u: User) => {
      if (!canWriteUsers) return;
      setSuccess(null);

      const ok = window.confirm(
        `Deactivate user "${u.email}"? You can re-enable later by editing status.`,
      );
      if (!ok) return;

      try {
        await deleteUser(u.id);

        // If we just removed the last row on this page, go back one page.
        if (users.length === 1 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
        } else {
          void fetchUsers();
        }
        setSuccess("User deactivated.");
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to deactivate user."));
      }
    },
    [canWriteUsers, fetchUsers, page, users.length],
  );

  if (!canReadUsers) {
    return <NotAuthorized />;
  }

  return (
    <div className="page">
      <h1 className="page-title">Users</h1>
      <div className="muted">Manage application users and access.</div>

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
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="name or email"
              type="text"
            />
          </label>

          <label className="field">
            <span className="muted">Status</span>
            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="ALL">ALL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>
        </div>

        {canWriteUsers ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={onOpenCreate}
          >
            Create User
          </button>
        ) : null}
      </div>

      <div className="card">
        <div className="card-title">Users</div>

        {loading ? (
          <div className="muted">Loading…</div>
        ) : users.length === 0 ? (
          <div className="muted">No users found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span
                      className={
                        u.status === "ACTIVE"
                          ? "badge badge-active"
                          : "badge badge-inactive"
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    {canWriteUsers ? (
                      <div className="row-actions">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => onOpenEdit(u)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => void onDelete(u)}
                        >
                          Deactivate
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

        <div className="pagination">
          <div className="muted">
            Page {page} of {totalPages} · Total {total}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={loading || page <= 1}
            >
              Prev
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || !hasNext}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        canWrite={canWriteUsers}
        onCreated={async () => {
          setCreateOpen(false);
          setPage(1);
          await fetchUsers();
          setSuccess("User created.");
        }}
        onError={(msg) => setError(msg)}
      />

      <EditUserModal
        isOpen={editOpen}
        onClose={onCloseEdit}
        canWrite={canWriteUsers}
        user={editingUser}
        onUpdated={async () => {
          onCloseEdit();
          await fetchUsers();
          setSuccess("User updated.");
        }}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

function CreateUserModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (msg: string) => void;
  canWrite: boolean;
}) {
  const { isOpen, onClose, onCreated, onError, canWrite } = props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
    setPassword("");
    setStatus("ACTIVE");
    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
  }, [isOpen]);

  const onSubmit = useCallback(async () => {
    if (!canWrite || submitting) return;
    setFieldError(null);
    setConflictError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setFieldError("Name, email, and password are required.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setFieldError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        name: trimmedName,
        email: trimmedEmail,
        password,
        status,
      });
      await onCreated();
    } catch (err) {
      if (isConflictError(err)) {
        setConflictError("Email already exists.");
      } else {
        onError(getApiErrorMessage(err, "Failed to create user."));
      }
    } finally {
      setSubmitting(false);
    }
  }, [canWrite, email, name, onCreated, onError, password, status, submitting]);

  return (
    <Modal title="Create user" isOpen={isOpen} onClose={onClose}>
      {!canWrite ? <div className="muted">Requires users.write.</div> : null}

      <div className="form">
        <label className="label">
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canWrite || submitting}
          />
        </label>

        <label className="label">
          Email
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canWrite || submitting}
          />
        </label>

        <label className="label">
          Password
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            disabled={!canWrite || submitting}
          />
        </label>

        <label className="label">
          Status
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            disabled={!canWrite || submitting}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      </div>

      {fieldError ? <div className="alert">{fieldError}</div> : null}
      {conflictError ? <div className="alert">{conflictError}</div> : null}

      <div className="modal-actions">
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canWrite || submitting}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

function EditUserModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onError: (msg: string) => void;
  canWrite: boolean;
  user: User | null;
}) {
  const { isOpen, onClose, onUpdated, onError, canWrite, user } = props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setName(user.name);
    setEmail(user.email);
    setStatus(user.status);
    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
  }, [isOpen, user]);

  const onSubmit = useCallback(async () => {
    if (!canWrite || submitting || !user) return;
    setFieldError(null);
    setConflictError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      setFieldError("Name and email are required.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setFieldError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await updateUser(user.id, {
        name: trimmedName,
        email: trimmedEmail,
        status,
      });
      await onUpdated();
    } catch (err) {
      if (isConflictError(err)) {
        setConflictError("Email already exists.");
      } else {
        onError(getApiErrorMessage(err, "Failed to update user."));
      }
    } finally {
      setSubmitting(false);
    }
  }, [canWrite, email, name, onError, onUpdated, status, submitting, user]);

  return (
    <Modal title="Edit user" isOpen={isOpen} onClose={onClose}>
      {!user ? <div className="muted">No user selected.</div> : null}
      {!canWrite ? <div className="muted">Requires users.write.</div> : null}

      <div className="form">
        <label className="label">
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canWrite || submitting || !user}
          />
        </label>

        <label className="label">
          Email
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canWrite || submitting || !user}
          />
        </label>

        <label className="label">
          Status
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            disabled={!canWrite || submitting || !user}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      </div>

      {fieldError ? <div className="alert">{fieldError}</div> : null}
      {conflictError ? <div className="alert">{conflictError}</div> : null}

      <div className="modal-actions">
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canWrite || submitting || !user}
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
