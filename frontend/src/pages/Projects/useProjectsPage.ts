import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { getProjects, type Project } from '../../api/projects';
import { isCanceledError } from '../../utils/errors';

export function useProjectsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);

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

  const fetchProjects = useCallback(
    async (opts?: { signal?: AbortSignal; page?: number; limit?: number }) => {
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await getProjects(
          { page: opts?.page ?? page, limit: opts?.limit ?? limit },
          { signal: opts?.signal }
        );
        if (fetchSeqRef.current !== seq) return;
        setProjects(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, 'Failed to load projects.'));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [limit, page]
  );

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    void fetchProjects({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchProjects, limit, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onApplyFilters = useCallback(() => {
    skipAutoFetchRef.current = true;
    setPage(1);
    void fetchProjects({ signal: new AbortController().signal, page: 1, limit });
  }, [fetchProjects, limit]);

  const onResetFilters = useCallback(() => {
    skipAutoFetchRef.current = true;
    setPage(1);
    setLimit(10);
    void fetchProjects({ signal: new AbortController().signal, page: 1, limit: 10 });
  }, [fetchProjects]);

  return {
    page,
    setPage,
    limit,
    setLimit,
    projects,
    total,
    hasNext,
    loading,
    error,
    archiveOpen,
    setArchiveOpen,
    archiveProject,
    setArchiveProject,
    totalPages,
    showingFrom,
    showingTo,
    fetchProjects,
    onApplyFilters,
    onResetFilters,
  };
}
