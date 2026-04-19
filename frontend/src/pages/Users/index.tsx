import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getApiErrorMessage } from "../../api/client";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Separator } from "../../components/ui/separator";
import { Card, CardContent } from "../../components/ui/card";
import { toast } from "../../components/ui/use-toast";
import { DetailsSheet } from "../../components/DetailsSheet";
import { Badge } from "../../components/ui/badge";
import { NotAuthorized } from "../../components/common/NotAuthorized";
import { PageStatsGrid } from "../../components/common/PageStatsGrid";
import { TablePagination } from "../../components/common/TablePagination";
import { UsersTable } from "./UsersTable";
import { CreateUserModal } from "./CreateUserModal";
import { EditUserModal } from "./EditUserModal";
import { formatDate } from "../../utils/format";
import { isCanceledError } from "../../utils/errors";
import {
  createUser,
  deleteUser,
  getUsers,
  permanentlyDeleteUser,
  type User,
  type UserStatus,
} from "../../api/users";
import { getApiErrorMessage as _getApiErrorMessage } from "../../api/client";

type StatusFilter = "ALL" | UserStatus;

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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);
  const showingFrom = useMemo(() => (total === 0 ? 0 : (page - 1) * limit + 1), [limit, page, total]);
  const showingTo = useMemo(() => (total === 0 ? 0 : Math.min(page * limit, total)), [limit, page, total]);

  const fetchUsers = useCallback(
    async (opts?: { signal?: AbortSignal; page?: number; limit?: number; search?: string; status?: StatusFilter }) => {
      if (!canReadUsers) return;
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await getUsers(
          {
            page: opts?.page ?? page,
            limit: opts?.limit ?? limit,
            search: opts?.search ?? search,
            status: opts?.status ?? status,
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
    if (skipAutoFetchRef.current) { skipAutoFetchRef.current = false; return; }
    const controller = new AbortController();
    void fetchUsers({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadUsers, fetchUsers, limit, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onApplyFilters = useCallback(() => {
    setSuccess(null);
    setError(null);
    skipAutoFetchRef.current = true;
    setPage(1);
    setSearch(searchInput);
    setStatus(statusInput);
    void fetchUsers({ signal: new AbortController().signal, page: 1, limit, search: searchInput, status: statusInput });
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
    void fetchUsers({ signal: new AbortController().signal, page: 1, limit: 10, search: "", status: "ALL" });
  }, [fetchUsers]);

  const roleTextForUser = useCallback((u: User): { text: string; title?: string } => {
    const roleNames = (
      Array.isArray(u.roles) && u.roles.length > 0
        ? u.roles.map((r) => r.name)
        : u.roleName ? [u.roleName] : []
    ).filter((x) => typeof x === "string" && x.trim().length > 0);

    if (roleNames.length === 0) return { text: "—" };
    if (roleNames.length === 1) return { text: roleNames[0] };
    return { text: `${roleNames[0]} +${roleNames.length - 1}`, title: roleNames.join(", ") };
  }, []);

  const onDelete = useCallback(async (u: User) => {
    if (!canWriteUsers) return;
    setSuccess(null);
    try {
      await deleteUser(u.id);
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
  }, [canWriteUsers, fetchUsers, page, users.length]);

  const onConfirmDeactivate = useCallback(() => {
    if (!deactivateUser) return;
    setDeactivateOpen(false);
    void onDelete(deactivateUser);
  }, [deactivateUser, onDelete]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget || !canWriteUsers) return;
    if (deleteConfirmText.trim() !== deleteTarget.email) {
      setError(`Type ${deleteTarget.email} to confirm deletion.`);
      toast.error("Delete blocked", { description: "Confirmation did not match." });
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
    return <NotAuthorized resource="users" />;
  }

  const stats = [
    { title: "Total Users", value: total, loading },
    { title: "Showing", value: users.length, loading },
    { title: "Page", value: `${page} / ${totalPages}`, loading },
    { title: "Page Size", value: limit, loading },
  ];

  return (
    <div className="w-full space-y-4">
      {success ? <Alert variant="success"><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? (
        <Alert variant="destructive">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AlertDescription className="sm:pr-4">{error}</AlertDescription>
            <Button variant="outline" size="sm" type="button" onClick={() => { setSuccess(null); void fetchUsers(); }}>Retry</Button>
          </div>
        </Alert>
      ) : null}

      <PageStatsGrid stats={stats} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search"
                type="text"
                className="h-10 w-full placeholder:text-slate-400 lg:col-span-2"
              />
              <Select value={statusInput} onValueChange={(value) => setStatusInput(value as StatusFilter)}>
                <SelectTrigger aria-label="Status" className="h-10 w-full lg:col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <Button type="button" onClick={onApplyFilters} disabled={loading} className="h-10 w-full sm:w-auto">Apply Filters</Button>
              <Button type="button" variant="outline" onClick={onResetFilters} disabled={loading} className="h-10 w-full sm:w-auto">Reset Filters</Button>
              <Separator orientation="horizontal" className="sm:hidden" />
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button type="button" onClick={() => { setSuccess(null); setCreateOpen(true); }} className="h-10 w-full sm:w-auto" disabled={!canWriteUsers}>Create User</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          <UsersTable
            users={users}
            loading={loading}
            canReadUsers={canReadUsers}
            canWriteUsers={canWriteUsers}
            canEditUsers={canEditUsers}
            meId={me?.id}
            roleTextForUser={roleTextForUser}
            onRequestView={(u) => { setViewUser(u); setViewOpen(true); }}
            onOpenEdit={(u) => { setSuccess(null); setEditingUser(u); setEditOpen(true); }}
            onRequestDeactivate={(u) => { setDeactivateUser(u); setDeactivateOpen(true); }}
            onRequestDelete={(u) => { setDeleteTarget(u); setDeleteConfirmText(""); setDeleteOpen(true); }}
          />
          <TablePagination
            page={page}
            totalPages={totalPages}
            hasNext={hasNext}
            limit={limit}
            showingFrom={showingFrom}
            showingTo={showingTo}
            total={total}
            resourceLabel="users"
            loading={loading}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </CardContent>
      </Card>

      <AlertDialog open={deactivateOpen} onOpenChange={(open) => { setDeactivateOpen(open); if (!open) setDeactivateUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateUser ? `Deactivate user "${deactivateUser.email}"? You can re-enable later by editing status.` : "Are you sure you want to deactivate this user?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" className={buttonVariants({ variant: "destructive" })} onClick={onConfirmDeactivate}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `This will permanently delete user "${deleteTarget.email}". Type the user's email to confirm.` : "This action is irreversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget ? (
            <div className="mt-3 space-y-2">
              <Label>Confirm email</Label>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteTarget.email} autoComplete="off" />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={onConfirmDelete}
              disabled={!deleteTarget || Boolean(me?.id && deleteTarget?.id === me.id) || (deleteTarget ? deleteConfirmText.trim() !== deleteTarget.email : true)}
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
        onCreated={async () => { setCreateOpen(false); setPage(1); await fetchUsers(); setSuccess("User created."); toast.success("User created"); }}
        onError={(msg) => { setError(msg); toast.error("Action failed", { description: msg }); }}
      />

      <EditUserModal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setEditingUser(null); }}
        canEdit={canEditUsers}
        user={editingUser}
        onUpdated={async () => { setEditOpen(false); setEditingUser(null); await fetchUsers(); setSuccess("User updated."); toast.success("User updated"); }}
        onError={(msg) => { setError(msg); toast.error("Action failed", { description: msg }); }}
      />

      <DetailsSheet
        open={viewOpen}
        onOpenChange={(open) => { setViewOpen(open); if (!open) setViewUser(null); }}
        title="User details"
        description={viewUser ? viewUser.email : undefined}
      >
        {!viewUser ? (
          <div className="text-sm text-slate-500">No user selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><div className="text-sm">{viewUser.name || "—"}</div></div>
            <div className="space-y-1"><Label>Email</Label><div className="text-sm">{viewUser.email}</div></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div><Badge variant={viewUser.status === "ACTIVE" ? "success" : "destructive"}>{viewUser.status}</Badge></div>
            </div>
            <div className="space-y-1">
              <Label>Role(s)</Label>
              {(() => { const roles = roleTextForUser(viewUser); return <div className="text-sm" title={roles.title}>{roles.title ?? roles.text}</div>; })()}
            </div>
            <Separator />
            <div className="space-y-1"><Label>Created</Label><div className="text-sm">{formatDate(viewUser.createdAt)}</div></div>
            <div className="space-y-1"><Label>Updated</Label><div className="text-sm">{formatDate(viewUser.updatedAt)}</div></div>
          </div>
        )}
      </DetailsSheet>
    </div>
  );
}
