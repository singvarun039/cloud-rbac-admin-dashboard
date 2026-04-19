import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getRoles, permanentlyDeleteRole, type Role } from "../api/roles";
import {
  getRoleRecommendations,
  type RoleRecommendationsResponse,
} from "../api/roleRecommendations";
import { getApiErrorMessage } from "../api/client";
import RoleModal from "../components/RoleModal";
import AssignPermissionsModal from "../components/AssignPermissionsModal";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { buttonVariants } from "../components/ui/button-variants";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../components/ui/drawer";
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
import { Badge } from "../components/ui/badge";
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
import { StatsCard } from "../components/page/StatsCard";
import { ChevronDown, Eye, Pencil, Shield, Trash2 } from "lucide-react";

const PROTECTED_ROLE_NAMES = new Set(["ADMIN", "EDITOR", "USER", "VIEWER"]);

// Detects whether a request was canceled by the caller.
function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

// Renders the unauthorized state for the roles page.
function NotAuthorized() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden (403)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            You don't have permission to view roles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Builds a readable permission count label for a role.
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

// Formats an ISO timestamp for local display.
function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function renderSources(
  sources:
    | Array<{ key: string; label: string; description: string }>
    | undefined,
) {
  if (!sources?.length) {
    return <div className="text-sm text-slate-500">No source metadata.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <Badge key={source.key} variant="secondary" title={source.description}>
          {source.label}
        </Badge>
      ))}
    </div>
  );
}

// Renders the roles management page.
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
  const [roleRecommendations, setRoleRecommendations] =
    useState<RoleRecommendationsResponse | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(
    null,
  );
  const [showRecommendations, setShowRecommendations] = useState(false);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const hasNext = useMemo(() => {
    return page < totalPages;
  }, [page, totalPages]);

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

  const fetchSeqRef = useRef(0);
  const skipAutoFetchRef = useRef(false);
  const recommendationsAbortRef = useRef<AbortController | null>(null);
  const recommendationsLoadedRef = useRef(false);

  const fetchRoles = useCallback(
    async (opts?: {
      signal?: AbortSignal;
      page?: number;
      limit?: number;
      search?: string;
    }) => {
      if (!canReadRoles) return;

      const effectivePage = opts?.page ?? page;
      const effectiveLimit = opts?.limit ?? limit;
      const effectiveSearch = opts?.search ?? debouncedSearch;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getRoles(
          {
            page: effectivePage,
            limit: effectiveLimit,
            search: effectiveSearch,
          },
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
    // Keep page within range if total shrinks.
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    return () => recommendationsAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!canReadRoles) return;
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadRoles, debouncedSearch, fetchRoles, limit, page]);

  const onRetry = useCallback(() => {
    setSuccess(null);
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
  }, [fetchRoles]);

  const loadRoleRecommendations = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      recommendationsAbortRef.current?.abort();
      const controller = new AbortController();
      recommendationsAbortRef.current = controller;

      setRecommendationsLoading(true);
      setRecommendationsError(null);

      try {
        const res = await getRoleRecommendations(30, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRoleRecommendations(res);
        recommendationsLoadedRef.current = true;
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load role recommendations.";
        setRecommendationsError(msg);
        if (opts?.userInitiated) {
          toast.error("Role recommendations failed", { description: msg });
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecommendationsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!canReadRoles) return;
    if (!showRecommendations) return;
    if (recommendationsLoadedRef.current) return;
    void loadRoleRecommendations();
  }, [canReadRoles, loadRoleRecommendations, showRecommendations]);

  const onApplyFilters = useCallback(() => {
    setSuccess(null);
    setError(null);
    skipAutoFetchRef.current = true;

    setPage(1);
    setDebouncedSearch(searchInput);

    const controller = new AbortController();
    void fetchRoles({
      signal: controller.signal,
      page: 1,
      limit,
      search: searchInput,
    });
  }, [fetchRoles, limit, searchInput]);

  const onResetFilters = useCallback(() => {
    setSuccess(null);
    setError(null);
    skipAutoFetchRef.current = true;

    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
    setLimit(10);

    const controller = new AbortController();
    void fetchRoles({
      signal: controller.signal,
      page: 1,
      limit: 10,
      search: "",
    });
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

  const onRequestView = useCallback((r: Role) => {
    setViewRole(r);
    setViewOpen(true);
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

  const onRequestAssign = useCallback((r: Role) => {
    setAssignConfirmRole(r);
    setAssignConfirmOpen(true);
  }, []);

  const onConfirmAssign = useCallback(() => {
    if (!assignConfirmRole) return;
    setAssignConfirmOpen(false);
    onOpenAssign(assignConfirmRole);
  }, [assignConfirmRole, onOpenAssign]);

  const onRequestDelete = useCallback(
    (r: Role) => {
      if (!canWriteRoles) return;
      setSuccess(null);
      setError(null);
      setDeleteRole(r);
      setDeleteConfirmText("");
      setDeleteOpen(true);
    },
    [canWriteRoles],
  );

  const onConfirmDelete = useCallback(async () => {
    if (!canWriteRoles || !deleteRole || deleting) return;

    const expected = deleteRole.name;
    if (deleteConfirmText.trim() !== expected) {
      toast.error("Delete blocked", {
        description: "Confirmation did not match.",
      });
      return;
    }

    try {
      setDeleting(true);
      await permanentlyDeleteRole(deleteRole.id);
      setDeleteOpen(false);
      setDeleteRole(null);
      setDeleteConfirmText("");
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

  if (!canReadRoles) {
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
          <StatsCard title="Total Roles" value={total} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Showing" value={roles.length} loading={loading} />
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:flex-1">
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                }}
                placeholder="Search name or description"
                aria-label="Search"
                type="text"
                className="h-10 w-full placeholder:text-slate-400 sm:col-span-2"
              />
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-fit">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                    Reset
                  </Button>
                </div>

                <Separator orientation="horizontal" className="sm:hidden" />
                <Separator
                  orientation="vertical"
                  className="hidden h-6 sm:block"
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRecommendations(true)}
                    className="h-10 w-full sm:w-auto"
                  >
                    AI Recommendations
                  </Button>

                  <Button
                    type="button"
                    onClick={onOpenCreate}
                    className="h-10 w-full sm:w-auto"
                    disabled={!canWriteRoles}
                  >
                    Create Role
                  </Button>
                </div>
              </div>
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
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[220px] text-right">
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
                      <Skeleton className="h-4 w-56" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-36" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : roles.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No roles found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[220px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {r.description ? (
                        r.description
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>{permissionCountLabel(r)}</TableCell>
                    <TableCell className="text-right">
                      {canReadRoles ? (
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
                            <DropdownMenuItem onSelect={() => onRequestView(r)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>

                            {canEditRoles ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => onOpenEdit(r)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => onRequestAssign(r)}
                                  disabled={!canReadPermissions}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Assign Permissions
                                </DropdownMenuItem>
                              </>
                            ) : null}

                            {canWriteRoles ? (
                              <>
                                {(() => {
                                  const isProtected = PROTECTED_ROLE_NAMES.has(
                                    r.name,
                                  );
                                  return (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onSelect={() => onRequestDelete(r)}
                                        disabled={isProtected}
                                        className="text-red-700 focus:bg-red-50 focus:text-red-700 data-[disabled]:text-red-700/50"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {isProtected
                                          ? "Delete (system role)"
                                          : "Delete"}
                                      </DropdownMenuItem>
                                    </>
                                  );
                                })()}
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
              Showing {showingFrom}-{showingTo} of {total} roles
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
        open={assignConfirmOpen}
        onOpenChange={(open: boolean) => {
          setAssignConfirmOpen(open);
          if (!open) setAssignConfirmRole(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              {assignConfirmRole
                ? `Open permission assignment for role "${assignConfirmRole.name}"?`
                : "Open permission assignment for this role?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "default" })}
              onClick={onConfirmAssign}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Drawer open={showRecommendations} onOpenChange={setShowRecommendations}>
        <DrawerContent className="inset-y-0 right-0 left-auto h-full w-full max-w-[720px] border-l border-slate-200">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-6 py-5">
              <DrawerHeader className="space-y-2">
                <DrawerTitle>AI role recommendations</DrawerTitle>
                <DrawerDescription>
                  Review overlap, broad roles, and least-privilege cleanup without taking over the main Roles page.
                </DrawerDescription>
              </DrawerHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void loadRoleRecommendations({ userInitiated: true })
                    }
                    disabled={recommendationsLoading}
                  >
                    {recommendationsLoading
                      ? "Refreshing..."
                      : "Refresh recommendations"}
                  </Button>
                  {roleRecommendations?.analytics.roleAuditVisible === false ? (
                    <span className="text-sm text-slate-500">
                      Audit-based grounding is limited for this user.
                    </span>
                  ) : null}
                </div>

                {recommendationsError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{recommendationsError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Distinct permissions
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {recommendationsLoading && !roleRecommendations
                        ? "..."
                        : (roleRecommendations?.analytics.totalDistinctPermissions ??
                          "—")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Roles with no permissions
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {recommendationsLoading && !roleRecommendations
                        ? "..."
                        : (roleRecommendations?.analytics.rolesWithNoPermissions
                            .length ?? "—")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      High-overlap pairs
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {recommendationsLoading && !roleRecommendations
                        ? "..."
                        : (roleRecommendations?.analytics.overlapPairs.length ??
                          "—")}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    AI summary
                  </div>
                  {recommendationsLoading && !roleRecommendations ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ) : roleRecommendations?.answer ? (
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {roleRecommendations.answer}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">
                      No recommendation summary yet.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Data sources
                  </div>
                  {renderSources(roleRecommendations?.sources)}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Overlap pairs
                    </div>
                    {roleRecommendations?.analytics.overlapPairs.length ? (
                      <div className="space-y-2">
                        {roleRecommendations.analytics.overlapPairs
                          .slice(0, 3)
                          .map((pair) => (
                            <div
                              key={`${pair.roleA}-${pair.roleB}`}
                              className="rounded-lg border border-slate-200 p-3"
                            >
                              <div className="text-sm font-medium text-slate-900">
                                {pair.roleA} x {pair.roleB}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                Shared permissions: {pair.overlapCount}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {pair.sharedPermissions.slice(0, 4).map((key) => (
                                  <Badge key={key} variant="secondary">
                                    {key}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        No overlap analysis available yet.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Broadest roles
                    </div>
                    {roleRecommendations?.analytics.broadestRoles.length ? (
                      <div className="space-y-2">
                        {roleRecommendations.analytics.broadestRoles
                          .slice(0, 4)
                          .map((item) => (
                            <div
                              key={item.role}
                              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                            >
                              <span className="text-sm font-medium text-slate-900">
                                {item.role}
                              </span>
                              <Badge variant="secondary">
                                {item.permissionCount} permissions
                              </Badge>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        No role breadth data available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <DrawerFooter className="sm:justify-between">
                <div className="text-sm text-slate-500">
                  AI recommendations stay out of the main table flow until needed.
                </div>
                <DrawerClose asChild>
                  <Button type="button" variant="outline">
                    Close
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open: boolean) => {
          if (deleting) return;
          setDeleteOpen(open);
          if (!open) {
            setDeleteRole(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRole
                ? `This will permanently delete role "${deleteRole.name}". This action is irreversible. Type the role name to confirm.`
                : "This will permanently delete this role. This action is irreversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteRole ? (
            <div className="mt-3 space-y-2">
              <Label>Confirm role name</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteRole.name}
                autoComplete="off"
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={onConfirmDelete}
              disabled={
                deleting ||
                !deleteRole ||
                (deleteRole
                  ? deleteConfirmText.trim() !== deleteRole.name
                  : true)
              }
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RoleModal
        open={createOpen}
        mode="create"
        canCreate={canWriteRoles}
        canEdit={canEditRoles}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          await fetchRoles();
          setSuccess("Role created.");
          toast.success("Role created");
        }}
        onError={(msg) => {
          setError(msg);
          toast.error("Action failed", { description: msg });
        }}
      />

      <RoleModal
        open={editOpen}
        mode="edit"
        initialRole={editingRole}
        canCreate={canWriteRoles}
        canEdit={canEditRoles}
        onClose={onCloseEdit}
        onSuccess={async () => {
          onCloseEdit();
          await fetchRoles();
          setSuccess("Role updated.");
          toast.success("Role updated");
        }}
        onError={(msg) => {
          setError(msg);
          toast.error("Action failed", { description: msg });
        }}
      />

      <AssignPermissionsModal
        open={assignOpen}
        role={assigningRole}
        canEditRoles={canEditRoles}
        canReadPermissions={canReadPermissions}
        onClose={onCloseAssign}
        onSuccess={async () => {
          onCloseAssign();
          await fetchRoles();
          setSuccess("Role permissions updated.");
          toast.success("Permissions updated");
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
          if (!open) setViewRole(null);
        }}
        title="Role details"
        description={viewRole ? viewRole.name : undefined}
      >
        {!viewRole ? (
          <div className="text-sm text-slate-500">No role selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <div className="text-sm">{viewRole.name}</div>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <div className="text-sm">{viewRole.description || "—"}</div>
            </div>

            <div className="space-y-1">
              <Label>Permissions</Label>
              <div className="text-sm text-slate-700">
                {permissionCountLabel(viewRole)}
              </div>
              {Array.isArray(viewRole.permissions) &&
              viewRole.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {viewRole.permissions.map((p) => (
                    <Badge key={p.id} variant="secondary">
                      {p.key}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No permissions.</div>
              )}
            </div>

            <Separator />

            <div className="space-y-1">
              <Label>Created</Label>
              <div className="text-sm">{formatDate(viewRole.createdAt)}</div>
            </div>

            <div className="space-y-1">
              <Label>Updated</Label>
              <div className="text-sm">{formatDate(viewRole.updatedAt)}</div>
            </div>
          </div>
        )}
      </DetailsSheet>
    </div>
  );
}
