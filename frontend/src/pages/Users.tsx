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
import { buttonVariants } from "../components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "../components/ui/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
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
import { FiltersCard } from "../components/page/FiltersCard";
import { StatsCard } from "../components/page/StatsCard";
import { TableCard } from "../components/page/TableCard";
import { Pencil, UserX } from "lucide-react";

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
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function NotAuthorized() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden (403)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            You don't have permission to view users.
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
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null);

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

  const showingFrom = useMemo(() => {
    if (total === 0) return 0;
    return (page - 1) * limit + 1;
  }, [limit, page, total]);

  const showingTo = useMemo(() => {
    if (total === 0) return 0;
    return Math.min(page * limit, total);
  }, [limit, page, total]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);

    if (page <= 3) {
      start = 2;
      end = 4;
    }
    if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    start = Math.max(2, start);
    end = Math.min(totalPages - 1, end);

    const items: Array<number | "ellipsis"> = [1];
    if (start > 2) items.push("ellipsis");
    for (let p = start; p <= end; p++) items.push(p);
    if (end < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);
    return items;
  }, [page, totalPages]);

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

      try {
        await deleteUser(u.id);

        // If we just removed the last row on this page, go back one page.
        if (users.length === 1 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
        } else {
          void fetchUsers();
        }
        setSuccess("User deactivated.");
        toast.success("User deactivated");
      } catch (err) {
        const msg = getApiErrorMessage(err, "Failed to deactivate user.");
        setError(msg);
        toast.error("Action failed", { description: msg });
      }
    },
    [canWriteUsers, fetchUsers, page, users.length],
  );

  const onRequestDeactivate = useCallback((u: User) => {
    setDeactivateUser(u);
    setDeactivateOpen(true);
  }, []);

  const onConfirmDeactivate = useCallback(() => {
    if (!deactivateUser) return;
    setDeactivateOpen(false);
    void onDelete(deactivateUser);
  }, [deactivateUser, onDelete]);

  if (!canReadUsers) {
    return <NotAuthorized />;
  }

  return (
    <div className="w-full space-y-4">
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

      <div className="grid w-full grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Total Users" value={total} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Showing" value={users.length} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard
            title="Page"
            value={`${page} / ${totalPages}`}
            loading={loading}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Page Size" value={limit} loading={loading} />
        </div>
      </div>

      <FiltersCard
        title="Filters"
        filters={
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
        }
        actions={
          <>
            <Button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="h-10"
            >
              Apply Filters
            </Button>
            {canWriteUsers ? (
              <Button
                variant="outline"
                type="button"
                onClick={onOpenCreate}
                className="h-10"
              >
                Create User
              </Button>
            ) : null}
          </>
        }
      />

      <TableCard title="Users">
        <>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="h-9 px-2"
                            >
                              ...
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onOpenEdit(u)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => onRequestDeactivate(u)}
                              className="text-red-700 focus:bg-red-50 focus:text-red-700"
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="text-sm text-slate-500">
                Showing {showingFrom}-{showingTo} of {total} users
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-slate-600">Page size</Label>
                <Select
                  value={String(limit)}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 w-[92px]"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
              </div>
            </div>

            <Pagination className="sm:mx-0 sm:w-auto sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (loading || page <= 1) return;
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    className={
                      loading || page <= 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>

                {paginationItems.map((item, idx) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`e-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === page}
                        onClick={(e) => {
                          e.preventDefault();
                          if (loading) return;
                          setPage(item);
                        }}
                        className={loading ? "pointer-events-none" : undefined}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (loading || !hasNext) return;
                      setPage((p) => p + 1);
                    }}
                    className={
                      loading || !hasNext
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      </TableCard>

      <AlertDialog
        open={deactivateOpen}
        onOpenChange={(open: boolean) => {
          setDeactivateOpen(open);
          if (!open) setDeactivateUser(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateUser
                ? `Deactivate user "${deactivateUser.email}"? You can re-enable later by editing status.`
                : "Are you sure you want to deactivate this user?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={onConfirmDeactivate}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        canWrite={canWriteUsers}
        onCreated={async () => {
          setCreateOpen(false);
          setPage(1);
          await fetchUsers();
          setSuccess("User created.");
          toast.success("User created");
        }}
        onError={(msg) => {
          setError(msg);
          toast.error("Action failed", { description: msg });
        }}
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
          toast.success("User updated");
        }}
        onError={(msg) => {
          setError(msg);
          toast.error("Action failed", { description: msg });
        }}
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
          {submitting ? "Creating..." : "Create"}
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
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
