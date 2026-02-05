import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal";
import { useAuth } from "../auth/useAuth";
import { getApiErrorMessage } from "../api/client";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden (403)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            You don’t have permission to view users.
          </p>
        </CardContent>
      </Card>
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-slate-600">
          Manage application users and access.
        </p>
      </div>

      {success ? (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AlertDescription className="sm:pr-4">{error}</AlertDescription>
            <Button variant="outline" size="sm" type="button" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="grid gap-1.5">
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="name or email"
              type="text"
              className="h-10"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="h-10"
            >
              <option value="ALL">ALL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Select>
          </div>
        </div>

        {canWriteUsers ? (
          <Button type="button" onClick={onOpenCreate} className="h-10">
            Create User
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[170px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-44" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-24" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[170px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.status === "ACTIVE" ? "success" : "destructive"
                        }
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canWriteUsers ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => onOpenEdit(u)}
                            className="h-9 min-w-20"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => void onDelete(u)}
                            className="h-9 min-w-24"
                          >
                            Deactivate
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Page {page} of {totalPages} · Total {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || !hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
      {!canWrite ? (
        <div className="space-y-1 text-sm text-slate-500">
          <p>Requires users.write.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canWrite || submitting}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canWrite || submitting}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            disabled={!canWrite || submitting}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            disabled={!canWrite || submitting}
            className="h-10"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </Select>
        </div>
      </div>

      {fieldError || conflictError ? (
        <div className="space-y-3">
          {fieldError ? (
            <Alert variant="destructive">
              <AlertDescription>{fieldError}</AlertDescription>
            </Alert>
          ) : null}
          {conflictError ? (
            <Alert variant="destructive">
              <AlertDescription>{conflictError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canWrite || submitting}
        >
          {submitting ? "Creating…" : "Create"}
        </Button>
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
      {!user || !canWrite ? (
        <div className="space-y-1 text-sm text-slate-500">
          {!user ? <p>No user selected.</p> : null}
          {!canWrite ? <p>Requires users.write.</p> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canWrite || submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canWrite || submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            disabled={!canWrite || submitting || !user}
            className="h-10"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </Select>
        </div>
      </div>

      {fieldError || conflictError ? (
        <div className="space-y-3">
          {fieldError ? (
            <Alert variant="destructive">
              <AlertDescription>{fieldError}</AlertDescription>
            </Alert>
          ) : null}
          {conflictError ? (
            <Alert variant="destructive">
              <AlertDescription>{conflictError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canWrite || submitting || !user}
        >
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
