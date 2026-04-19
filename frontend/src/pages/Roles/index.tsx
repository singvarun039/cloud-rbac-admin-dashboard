import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getRoles, permanentlyDeleteRole, type Role } from "../../api/roles";
import { getRoleRecommendations, type RoleRecommendationsResponse } from "../../api/roleRecommendations";
import { getApiErrorMessage } from "../../api/client";
import RoleModal from "../../components/RoleModal";
import AssignPermissionsModal from "../../components/AssignPermissionsModal";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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
import { Separator } from "../../components/ui/separator";
import { toast } from "../../components/ui/use-toast";
import { DetailsSheet } from "../../components/DetailsSheet";
import { Badge } from "../../components/ui/badge";
import { NotAuthorized } from "../../components/common/NotAuthorized";
import { PageStatsGrid } from "../../components/common/PageStatsGrid";
import { TablePagination } from "../../components/common/TablePagination";
import { RolesTable } from "./RolesTable";
import { RolesRecommendationsDrawer } from "./RolesRecommendationsDrawer";
import { isCanceledError } from "../../utils/errors";

export default function RolesPage() {
  const { permissions } = useAuth();

  const canReadRoles = permissions.includes("roles.read");
  const canWriteRoles = permissions.includes("roles.write");
  const canEditRoles = canWriteRoles || permissions.includes("roles.edit");
  const canReadPermissions = permissions.includes("permissions.read");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningRole, setAssigningRole] = useState<Role | null>(null);
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [assignConfirmRole, setAssignConfirmRole] = useState<Role | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [recommendations, setRecommendations] = useState<RoleRecommendationsResponse | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);
  const hasNext = useMemo(() => page < totalPages, [page, totalPages]);
  const showingFrom = useMemo(() => (total === 0 ? 0 : (page - 1) * limit + 1), [limit, page, total]);
  const showingTo = useMemo(() => (total === 0 ? 0 : Math.min(page * limit, total)), [limit, page, total]);

  const fetchSeqRef = useRef(0);
  const skipAutoFetchRef = useRef(false);
  const recommendationsAbortRef = useRef<AbortController | null>(null);
  const recommendationsLoadedRef = useRef(false);

  const fetchRoles = useCallback(
    async (opts?: { signal?: AbortSignal; page?: number; limit?: number; search?: string }) => {
      if (!canReadRoles) return;
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await getRoles(
          { page: opts?.page ?? page, limit: opts?.limit ?? limit, search: opts?.search ?? debouncedSearch },
          { signal: opts?.signal },
        );
        if (fetchSeqRef.current !== seq) return;
        setRoles(res.data);
        setTotal(res.meta.total);
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load roles."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadRoles, debouncedSearch, limit, page],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => { return () => recommendationsAbortRef.current?.abort(); }, []);

  useEffect(() => {
    if (!canReadRoles) return;
    if (skipAutoFetchRef.current) { skipAutoFetchRef.current = false; return; }
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadRoles, debouncedSearch, fetchRoles, limit, page]);

  const loadRoleRecommendations = useCallback(async (opts?: { userInitiated?: boolean }) => {
    recommendationsAbortRef.current?.abort();
    const controller = new AbortController();
    recommendationsAbortRef.current = controller;
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    try {
      const res = await getRoleRecommendations(30, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setRecommendations(res);
      recommendationsLoadedRef.current = true;
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to load role recommendations.";
      setRecommendationsError(msg);
      if (opts?.userInitiated) toast.error("Role recommendations failed", { description: msg });
    } finally {
      if (!controller.signal.aborted) setRecommendationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReadRoles || !showRecommendations || recommendationsLoadedRef.current) return;
    void loadRoleRecommendations();
  }, [canReadRoles, loadRoleRecommendations, showRecommendations]);

  const onApplyFilters = useCallback(() => {
    setSuccess(null); setError(null);
    skipAutoFetchRef.current = true;
    setPage(1); setDebouncedSearch(searchInput);
    void fetchRoles({ signal: new AbortController().signal, page: 1, limit, search: searchInput });
  }, [fetchRoles, limit, searchInput]);

  const onResetFilters = useCallback(() => {
    setSuccess(null); setError(null);
    skipAutoFetchRef.current = true;
    setSearchInput(""); setDebouncedSearch(""); setPage(1); setLimit(10);
    void fetchRoles({ signal: new AbortController().signal, page: 1, limit: 10, search: "" });
  }, [fetchRoles]);

  const onConfirmDelete = useCallback(async () => {
    if (!canWriteRoles || !deleteRole || deleting) return;
    if (deleteConfirmText.trim() !== deleteRole.name) {
      toast.error("Delete blocked", { description: "Confirmation did not match." });
      return;
    }
    try {
      setDeleting(true);
      await permanentlyDeleteRole(deleteRole.id);
      setDeleteOpen(false); setDeleteRole(null); setDeleteConfirmText("");
      await fetchRoles();
      setSuccess("Role deleted permanently.");
      toast.success("Role deleted");
    } catch (err) {
      const msg = getApiErrorMessage(err, "Failed to delete role.");
      setError(msg);
      toast.error("Action failed", { description: msg });
    } finally {
      setDeleting(false);
    }
  }, [canWriteRoles, deleteConfirmText, deleteRole, deleting, fetchRoles]);

  if (!canReadRoles) return <NotAuthorized resource="roles" />;

  const stats = [
    { title: "Total Roles", value: total, loading },
    { title: "Showing", value: roles.length, loading },
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
            <Button variant="outline" size="sm" type="button" onClick={() => { setSuccess(null); void fetchRoles(); }}>Retry</Button>
          </div>
        </Alert>
      ) : null}

      <PageStatsGrid stats={stats} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or description"
              aria-label="Search"
              type="text"
              className="h-10 w-full placeholder:text-slate-400"
            />
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button type="button" onClick={onApplyFilters} disabled={loading} className="h-10">Apply Filters</Button>
              <Button type="button" variant="outline" onClick={onResetFilters} disabled={loading} className="h-10">Reset</Button>
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button type="button" variant="outline" onClick={() => setShowRecommendations(true)} className="h-10">AI Recommendations</Button>
              <Button type="button" onClick={() => { setSuccess(null); setCreateOpen(true); }} className="h-10" disabled={!canWriteRoles}>Create Role</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          <RolesTable
            roles={roles}
            loading={loading}
            canReadRoles={canReadRoles}
            canWriteRoles={canWriteRoles}
            canEditRoles={canEditRoles}
            canReadPermissions={canReadPermissions}
            onRequestView={(r) => { setViewRole(r); setViewOpen(true); }}
            onOpenEdit={(r) => { setSuccess(null); setEditingRole(r); setEditOpen(true); }}
            onRequestAssign={(r) => { setAssignConfirmRole(r); setAssignConfirmOpen(true); }}
            onRequestDelete={(r) => { if (!canWriteRoles) return; setSuccess(null); setError(null); setDeleteRole(r); setDeleteConfirmText(""); setDeleteOpen(true); }}
          />
          <TablePagination
            page={page}
            totalPages={totalPages}
            hasNext={hasNext}
            limit={limit}
            showingFrom={showingFrom}
            showingTo={showingTo}
            total={total}
            resourceLabel="roles"
            loading={loading}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </CardContent>
      </Card>

      <AlertDialog open={assignConfirmOpen} onOpenChange={(open) => { setAssignConfirmOpen(open); if (!open) setAssignConfirmRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              {assignConfirmRole ? `Open permission assignment for role "${assignConfirmRole.name}"?` : "Open permission assignment for this role?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" className={buttonVariants({ variant: "default" })} onClick={() => { if (!assignConfirmRole) return; setAssignConfirmOpen(false); setAssigningRole(assignConfirmRole); setAssignOpen(true); }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setDeleteRole(null); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRole ? `Type "${deleteRole.name}" to confirm deletion of role "${deleteRole.name}".` : "This action is irreversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteRole ? (
            <div className="mt-3 space-y-2">
              <Label>Confirm role name</Label>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteRole.name} autoComplete="off" />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" className={buttonVariants({ variant: "destructive" })} disabled={!deleteRole || deleteConfirmText.trim() !== deleteRole.name || deleting} onClick={onConfirmDelete}>
              {deleting ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RoleModal
        open={createOpen}
        onOpenChange={(open) => { if (!open) setCreateOpen(false); }}
        mode="create"
        onSuccess={() => { setCreateOpen(false); void fetchRoles(); setSuccess("Role created."); toast.success("Role created"); }}
      />
      <RoleModal
        open={editOpen}
        onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingRole(null); } }}
        mode="edit"
        role={editingRole}
        onSuccess={() => { setEditOpen(false); setEditingRole(null); void fetchRoles(); setSuccess("Role updated."); toast.success("Role updated"); }}
      />
      {assigningRole ? (
        <AssignPermissionsModal
          open={assignOpen}
          role={assigningRole}
          canEditRoles={canEditRoles}
          canReadPermissions={canReadPermissions}
          onClose={() => { setAssignOpen(false); setAssigningRole(null); }}
          onSuccess={() => { setAssignOpen(false); setAssigningRole(null); void fetchRoles(); setSuccess("Permissions updated."); toast.success("Permissions updated"); }}
          onError={(msg) => { setError(msg); toast.error("Action failed", { description: msg }); }}
        />
      ) : null}

      <DetailsSheet
        open={viewOpen}
        onOpenChange={(open) => { setViewOpen(open); if (!open) setViewRole(null); }}
        title="Role details"
        description={viewRole ? viewRole.name : undefined}
      >
        {!viewRole ? <div className="text-sm text-slate-500">No role selected.</div> : (
          <div className="space-y-4">
            <div><Label>Name</Label><div className="text-sm">{viewRole.name}</div></div>
            <div><Label>Description</Label><div className="text-sm">{viewRole.description || "—"}</div></div>
            <div>
              <Label>Permissions</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {Array.isArray(viewRole.permissions) && viewRole.permissions.length > 0
                  ? viewRole.permissions.map((p) => <Badge key={typeof p === "string" ? p : p.id} variant="secondary">{typeof p === "string" ? p : p.key}</Badge>)
                  : <div className="text-sm text-slate-500">{typeof viewRole.permissionCount === "number" ? `${viewRole.permissionCount} permissions (load role for details)` : "—"}</div>
                }
              </div>
            </div>
          </div>
        )}
      </DetailsSheet>

      <RolesRecommendationsDrawer
        open={showRecommendations}
        onOpenChange={setShowRecommendations}
        recommendations={recommendations}
        loading={recommendationsLoading}
        error={recommendationsError}
        onRefresh={() => void loadRoleRecommendations({ userInitiated: true })}
      />
    </div>
  );
}
