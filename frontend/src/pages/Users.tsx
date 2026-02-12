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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "../components/ui/use-toast";
import { DetailsSheet } from "../components/DetailsSheet";
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
  permanentlyDeleteUser,
  updateUser,
  type User,
  type UserStatus,
} from "../api/users";
import { getRoles, type Role } from "../api/roles";
import { StatsCard } from "../components/page/StatsCard";
import { ChevronDown, Eye, EyeOff, Pencil, Trash2, UserX } from "lucide-react";

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
  const { permissions, user: me } = useAuth();

  const canReadUsers = permissions.includes("users.read");
  const canWriteUsers = permissions.includes("users.write");
  const canEditUsers = canWriteUsers || permissions.includes("users.edit");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState<StatusFilter>("ALL");

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState<User | null>(null);

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
  const skipAutoFetchRef = useRef(false);

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
    async (opts?: {
      signal?: AbortSignal;
      page?: number;
      limit?: number;
      search?: string;
      status?: StatusFilter;
    }) => {
      if (!canReadUsers) return;

      const effectivePage = opts?.page ?? page;
      const effectiveLimit = opts?.limit ?? limit;
      const effectiveSearch = opts?.search ?? search;
      const effectiveStatus = opts?.status ?? status;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getUsers(
          {
            page: effectivePage,
            limit: effectiveLimit,
            search: effectiveSearch,
            status: effectiveStatus,
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
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    void fetchUsers({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadUsers, fetchUsers, limit, page]);

  useEffect(() => {
    // Keep page within range if total shrinks.
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRetry = useCallback(() => {
    setSuccess(null);
    const controller = new AbortController();
    void fetchUsers({ signal: controller.signal });
  }, [fetchUsers]);

  const onApplyFilters = useCallback(() => {
    setSuccess(null);
    setError(null);
    skipAutoFetchRef.current = true;

    setPage(1);
    setSearch(searchInput);
    setStatus(statusInput);

    const controller = new AbortController();
    void fetchUsers({
      signal: controller.signal,
      page: 1,
      limit,
      search: searchInput,
      status: statusInput,
    });
  }, [fetchUsers, limit, searchInput, statusInput]);

  const onResetFilters = useCallback(() => {
    setSuccess(null);
    setError(null);
    skipAutoFetchRef.current = true;

    setSearchInput("");
    setStatusInput("ALL");
    setSearch("");
    setStatus("ALL");
    setPage(1);
    setLimit(10);

    const controller = new AbortController();
    void fetchUsers({
      signal: controller.signal,
      page: 1,
      limit: 10,
      search: "",
      status: "ALL",
    });
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

  const onRequestDelete = useCallback((u: User) => {
    setDeleteTarget(u);
    setDeleteConfirmText("");
    setDeleteOpen(true);
  }, []);

  const onRequestView = useCallback((u: User) => {
    setViewUser(u);
    setViewOpen(true);
  }, []);

  const roleTextForUser = useCallback(
    (u: User): { text: string; title?: string } => {
      const roleNames = (
        Array.isArray(u.roles) && u.roles.length > 0
          ? u.roles.map((r) => r.name)
          : u.roleName
            ? [u.roleName]
            : []
      ).filter((x) => typeof x === "string" && x.trim().length > 0);

      if (roleNames.length === 0) return { text: "—" };
      if (roleNames.length === 1) return { text: roleNames[0] };
      return {
        text: `${roleNames[0]} +${roleNames.length - 1}`,
        title: roleNames.join(", "),
      };
    },
    [],
  );

  const onConfirmDeactivate = useCallback(() => {
    if (!deactivateUser) return;
    setDeactivateOpen(false);
    void onDelete(deactivateUser);
  }, [deactivateUser, onDelete]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget || !canWriteUsers) return;

    const expected = deleteTarget.email;
    if (deleteConfirmText.trim() !== expected) {
      setError(`Type ${expected} to confirm deletion.`);
      toast.error("Delete blocked", {
        description: "Confirmation did not match.",
      });
      return;
    }

    try {
      await permanentlyDeleteUser(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      setPage(1);
      await fetchUsers({ page: 1 });
      setSuccess("User deleted permanently.");
      toast.success("User deleted");
    } catch (err) {
      const msg = getApiErrorMessage(err, "Failed to delete user.");
      setError(msg);
      toast.error("Action failed", { description: msg });
    }
  }, [canWriteUsers, deleteConfirmText, deleteTarget, fetchUsers]);

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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                }}
                placeholder="Search name or email"
                aria-label="Search"
                type="text"
                className="h-10 w-full placeholder:text-slate-400 lg:col-span-2"
              />

              <Select
                value={statusInput}
                onValueChange={(value) => {
                  setStatusInput(value as StatusFilter);
                }}
              >
                <SelectTrigger
                  aria-label="Status"
                  className="h-10 w-full lg:col-span-2"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <Button
                type="button"
                onClick={onApplyFilters}
                disabled={loading}
                className="h-10 w-full sm:w-auto"
              >
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onResetFilters}
                disabled={loading}
                className="h-10 w-full sm:w-auto"
              >
                Reset Filters
              </Button>

              <Separator orientation="horizontal" className="sm:hidden" />
              <Separator
                orientation="vertical"
                className="hidden h-6 sm:block"
              />

              <Button
                type="button"
                onClick={onOpenCreate}
                className="h-10 w-full sm:w-auto"
                disabled={!canWriteUsers}
              >
                Create User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
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
                      <Skeleton className="h-4 w-20" />
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
                  <TableHead>Role</TableHead>
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
                      {(() => {
                        const role = roleTextForUser(u);
                        return <span title={role.title}>{role.text}</span>;
                      })()}
                    </TableCell>
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
                      {canReadUsers ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="h-8 px-2"
                            >
                              Action
                              <ChevronDown className="ml-1 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onRequestView(u)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>

                            {canEditUsers ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => onOpenEdit(u)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              </>
                            ) : null}

                            {canWriteUsers ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => onRequestDeactivate(u)}
                                  className="text-red-700 focus:bg-red-50 focus:text-red-700"
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => onRequestDelete(u)}
                                  disabled={Boolean(me?.id && me.id === u.id)}
                                  className="text-red-700 focus:bg-red-50 focus:text-red-700"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : null}
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
            <div className="text-sm text-slate-500">
              Showing {showingFrom}-{showingTo} of {total} users
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
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
                          className={
                            loading ? "pointer-events-none" : undefined
                          }
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

              <div className="flex items-center gap-2">
                <Label className="text-sm text-slate-600">Page size</Label>
                <Select
                  value={String(limit)}
                  onValueChange={(value) => {
                    setLimit(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-[92px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open: boolean) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete user "${deleteTarget.email}". This action is irreversible. Type the user's email to confirm.`
                : "This will permanently delete this user. This action is irreversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTarget ? (
            <div className="mt-3 space-y-2">
              <Label>Confirm email</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.email}
                autoComplete="off"
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={onConfirmDelete}
              disabled={
                !deleteTarget ||
                Boolean(me?.id && deleteTarget?.id === me.id) ||
                (deleteTarget
                  ? deleteConfirmText.trim() !== deleteTarget.email
                  : true)
              }
            >
              Delete permanently
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
        canEdit={canEditUsers}
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

      <DetailsSheet
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setViewUser(null);
        }}
        title="User details"
        description={viewUser ? viewUser.email : undefined}
      >
        {!viewUser ? (
          <div className="text-sm text-slate-500">No user selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <div className="text-sm">{viewUser.name || "—"}</div>
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <div className="text-sm">{viewUser.email}</div>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <div>
                <Badge
                  variant={
                    viewUser.status === "ACTIVE" ? "success" : "destructive"
                  }
                >
                  {viewUser.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Role(s)</Label>
              {(() => {
                const roles = roleTextForUser(viewUser);
                return (
                  <div className="text-sm" title={roles.title}>
                    {roles.title ?? roles.text}
                  </div>
                );
              })()}
            </div>

            <Separator />

            <div className="space-y-1">
              <Label>Created</Label>
              <div className="text-sm">{formatDate(viewUser.createdAt)}</div>
            </div>

            <div className="space-y-1">
              <Label>Updated</Label>
              <div className="text-sm">{formatDate(viewUser.updatedAt)}</div>
            </div>
          </div>
        )}
      </DetailsSheet>
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
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [systemDefaultRoleName, setSystemDefaultRoleName] = useState<
    string | null
  >(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setStatus("ACTIVE");
    setRoleId("");
    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canWrite) return;

    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(null);

    void (async () => {
      try {
        const res = await getRoles(
          { page: 1, limit: 100 },
          { signal: controller.signal },
        );
        const items = res.data;
        setRoles(items);

        const preferred =
          items.find((r) => r.name.trim().toLowerCase() === "viewer") ??
          items.find((r) => r.name.trim().toLowerCase() === "user") ??
          null;

        setSystemDefaultRoleName(preferred?.name ?? items[0]?.name ?? null);
      } catch (err) {
        if (isCanceledError(err)) return;
        setRoles([]);
        setSystemDefaultRoleName(null);
        setRolesError(getApiErrorMessage(err, "Failed to load roles."));
      } finally {
        setRolesLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canWrite, isOpen]);

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
    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        password,
        status,
        ...(roleId ? { roleId } : {}),
      };

      await createUser(payload);
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
  }, [
    canWrite,
    email,
    name,
    onCreated,
    onError,
    password,
    roleId,
    status,
    submitting,
  ]);

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
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              disabled={!canWrite || submitting}
              className="h-10 pr-10"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              disabled={!canWrite || submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as UserStatus)}
            disabled={!canWrite || submitting}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="INACTIVE">INACTIVE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={roleId ? roleId : "__default__"}
            onValueChange={(value) =>
              setRoleId(value === "__default__" ? "" : value)
            }
            disabled={!canWrite || submitting || rolesLoading}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                {systemDefaultRoleName
                  ? `System default (${systemDefaultRoleName})`
                  : "System default"}
              </SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rolesError ? (
            <p className="text-xs text-slate-500">{rolesError}</p>
          ) : null}
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
  canEdit: boolean;
  user: User | null;
}) {
  const { isOpen, onClose, onUpdated, onError, canEdit, user } = props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [roleId, setRoleId] = useState("");
  const initialRoleIdRef = useRef<string>("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setName(user.name);
    setEmail(user.email);
    setStatus(user.status);
    const currentRoleId = typeof user.roleId === "string" ? user.roleId : "";
    setRoleId(currentRoleId);
    initialRoleIdRef.current = currentRoleId;
    setPassword("");
    setShowPassword(false);
    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !canEdit || !user) return;

    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(null);

    void (async () => {
      try {
        const res = await getRoles(
          { page: 1, limit: 100 },
          { signal: controller.signal },
        );
        setRoles(res.data);
      } catch (err) {
        if (isCanceledError(err)) return;
        setRoles([]);
        setRolesError(getApiErrorMessage(err, "Failed to load roles."));
      } finally {
        setRolesLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canEdit, isOpen, user]);

  const onSubmit = useCallback(async () => {
    if (!canEdit || submitting || !user) return;
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

    const trimmedPassword = password.trim();
    if (trimmedPassword && trimmedPassword.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Parameters<typeof updateUser>[1] = {
        name: trimmedName,
        email: trimmedEmail,
        status,
        ...(roleId && roleId !== initialRoleIdRef.current ? { roleId } : {}),
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      };

      await updateUser(user.id, payload);
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
  }, [
    canEdit,
    email,
    name,
    onError,
    onUpdated,
    password,
    roleId,
    status,
    submitting,
    user,
  ]);

  return (
    <Modal title="Edit user" isOpen={isOpen} onClose={onClose}>
      {!user || !canEdit ? (
        <div className="space-y-1 text-sm text-slate-500">
          {!user ? <p>No user selected.</p> : null}
          {!canEdit ? <p>Requires users.write or users.edit.</p> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canEdit || submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canEdit || submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as UserStatus)}
            disabled={!canEdit || submitting || !user}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="INACTIVE">INACTIVE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={roleId ? roleId : "__keep_current__"}
            onValueChange={(value) =>
              setRoleId(value === "__keep_current__" ? "" : value)
            }
            disabled={!canEdit || submitting || !user || rolesLoading}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__keep_current__">
                {user?.roleName
                  ? `Keep current role (${user.roleName})`
                  : "Select role"}
              </SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rolesError ? (
            <p className="text-xs text-slate-500">{rolesError}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Password (optional)</Label>
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              disabled={!canEdit || submitting || !user}
              className="h-10 pr-10"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              disabled={!canEdit || submitting || !user}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
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
          disabled={!canEdit || submitting || !user}
        >
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
