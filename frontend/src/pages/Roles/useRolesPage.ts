import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getRoles, permanentlyDeleteRole, type Role } from "../../api/roles";
import { getRoleRecommendations, type RoleRecommendationsResponse } from "../../api/roleRecommendations";
import { getApiErrorMessage } from "../../api/client";
import { isCanceledError } from "../../utils/errors";
import { toast } from "../../components/ui/use-toast";

export function useRolesPage() {
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
      setLoading(true); setError(null);
      try {
        const res = await getRoles(
          { page: opts?.page ?? page, limit: opts?.limit ?? limit, search: opts?.search ?? debouncedSearch },
          { signal: opts?.signal },
        );
        if (fetchSeqRef.current !== seq) return;
        setRoles(res.data); setTotal(res.meta.total);
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

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
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
    setRecommendationsLoading(true); setRecommendationsError(null);
    try {
      const res = await getRoleRecommendations(30, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setRecommendations(res); recommendationsLoadedRef.current = true;
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
    setSuccess(null); setError(null); skipAutoFetchRef.current = true;
    setPage(1); setDebouncedSearch(searchInput);
    void fetchRoles({ signal: new AbortController().signal, page: 1, limit, search: searchInput });
  }, [fetchRoles, limit, searchInput]);

  const onResetFilters = useCallback(() => {
    setSuccess(null); setError(null); skipAutoFetchRef.current = true;
    setSearchInput(""); setDebouncedSearch(""); setPage(1); setLimit(10);
    void fetchRoles({ signal: new AbortController().signal, page: 1, limit: 10, search: "" });
  }, [fetchRoles]);

  const onConfirmDelete = useCallback(async () => {
    if (!canWriteRoles || !deleteRole || deleting) return;
    if (deleteConfirmText.trim() !== deleteRole.name) {
      toast.error("Delete blocked", { description: "Confirmation did not match." }); return;
    }
    try {
      setDeleting(true);
      await permanentlyDeleteRole(deleteRole.id);
      setDeleteOpen(false); setDeleteRole(null); setDeleteConfirmText("");
      await fetchRoles();
      setSuccess("Role deleted permanently."); toast.success("Role deleted");
    } catch (err) {
      const msg = getApiErrorMessage(err, "Failed to delete role.");
      setError(msg); toast.error("Action failed", { description: msg });
    } finally {
      setDeleting(false);
    }
  }, [canWriteRoles, deleteConfirmText, deleteRole, deleting, fetchRoles]);

  return {
    canReadRoles, canWriteRoles, canEditRoles, canReadPermissions,
    page, setPage, limit, setLimit, searchInput, setSearchInput,
    roles, total, hasNext, loading, error, setError, success, setSuccess,
    createOpen, setCreateOpen, editOpen, setEditOpen, editingRole, setEditingRole,
    assignOpen, setAssignOpen, assigningRole, setAssigningRole,
    assignConfirmOpen, setAssignConfirmOpen, assignConfirmRole, setAssignConfirmRole,
    viewOpen, setViewOpen, viewRole, setViewRole,
    deleteOpen, setDeleteOpen, deleteRole, setDeleteRole,
    deleteConfirmText, setDeleteConfirmText, deleting,
    recommendations, recommendationsLoading, recommendationsError,
    showRecommendations, setShowRecommendations,
    totalPages, showingFrom, showingTo,
    fetchRoles, onApplyFilters, onResetFilters, onConfirmDelete, loadRoleRecommendations,
  };
}
