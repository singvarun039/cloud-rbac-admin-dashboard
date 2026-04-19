import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { getUsers, type User, type UserStatus } from '../../api/users';
import { isCanceledError } from '../../utils/errors';
import { useUserActions } from './useUserActions';

export type StatusFilter = 'ALL' | UserStatus;

export function useUsersPage() {
  const { permissions, user: me } = useAuth();
  const canReadUsers = permissions.includes('users.read');
  const canWriteUsers = permissions.includes('users.write');
  const canEditUsers = canWriteUsers || permissions.includes('users.edit');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [statusInput, setStatusInput] = useState<StatusFilter>('ALL');

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
  const showingFrom = useMemo(
    () => (total === 0 ? 0 : (page - 1) * limit + 1),
    [limit, page, total]
  );
  const showingTo = useMemo(
    () => (total === 0 ? 0 : Math.min(page * limit, total)),
    [limit, page, total]
  );

  const fetchUsers = useCallback(
    async (opts?: {
      signal?: AbortSignal;
      page?: number;
      limit?: number;
      search?: string;
      status?: StatusFilter;
    }) => {
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
          { signal: opts?.signal }
        );
        if (fetchSeqRef.current !== seq) return;
        setUsers(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, 'Failed to load users.'));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadUsers, limit, page, search, status]
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
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onApplyFilters = useCallback(() => {
    setSuccess(null);
    setError(null);
    skipAutoFetchRef.current = true;
    setPage(1);
    setSearch(searchInput);
    setStatus(statusInput);
    void fetchUsers({
      signal: new AbortController().signal,
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
    setSearchInput('');
    setStatusInput('ALL');
    setSearch('');
    setStatus('ALL');
    setPage(1);
    setLimit(10);
    void fetchUsers({
      signal: new AbortController().signal,
      page: 1,
      limit: 10,
      search: '',
      status: 'ALL',
    });
  }, [fetchUsers]);

  const roleTextForUser = useCallback((u: User): { text: string; title?: string } => {
    const roleNames = (
      Array.isArray(u.roles) && u.roles.length > 0
        ? u.roles.map((r) => r.name)
        : u.roleName
          ? [u.roleName]
          : []
    ).filter((x) => typeof x === 'string' && x.trim().length > 0);
    if (roleNames.length === 0) return { text: '—' };
    if (roleNames.length === 1) return { text: roleNames[0] };
    return { text: `${roleNames[0]} +${roleNames.length - 1}`, title: roleNames.join(', ') };
  }, []);

  const actions = useUserActions({
    canWriteUsers,
    users,
    page,
    setPage,
    fetchUsers,
    setError,
    setSuccess,
  });

  return {
    me,
    canReadUsers,
    canWriteUsers,
    canEditUsers,
    page,
    setPage,
    limit,
    setLimit,
    searchInput,
    setSearchInput,
    statusInput,
    setStatusInput,
    viewOpen,
    setViewOpen,
    viewUser,
    setViewUser,
    users,
    total,
    hasNext,
    loading,
    error,
    setError,
    success,
    setSuccess,
    createOpen,
    setCreateOpen,
    editOpen,
    setEditOpen,
    editingUser,
    setEditingUser,
    totalPages,
    showingFrom,
    showingTo,
    fetchUsers,
    onApplyFilters,
    onResetFilters,
    roleTextForUser,
    ...actions,
  };
}
