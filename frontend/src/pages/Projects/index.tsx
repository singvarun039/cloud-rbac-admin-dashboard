import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../../api/client";
import { getProjects, type Project } from "../../api/projects";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import { Card, CardContent } from "../../components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Separator } from "../../components/ui/separator";
import { PageStatsGrid } from "../../components/common/PageStatsGrid";
import { TablePagination } from "../../components/common/TablePagination";
import { ProjectsTable } from "./ProjectsTable";
import { isCanceledError } from "../../utils/errors";

export default function ProjectsPage() {
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
  const showingFrom = useMemo(() => (total === 0 ? 0 : (page - 1) * limit + 1), [limit, page, total]);
  const showingTo = useMemo(() => (total === 0 ? 0 : Math.min(page * limit, total)), [limit, page, total]);

  const fetchProjects = useCallback(async (opts?: { signal?: AbortSignal; page?: number; limit?: number }) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true); setError(null);
    try {
      const res = await getProjects(
        { page: opts?.page ?? page, limit: opts?.limit ?? limit },
        { signal: opts?.signal },
      );
      if (fetchSeqRef.current !== seq) return;
      setProjects(res.data);
      setTotal(res.meta.total);
      setHasNext(Boolean(res.meta.hasNext));
    } catch (err) {
      if (isCanceledError(err)) return;
      if (fetchSeqRef.current !== seq) return;
      setError(getApiErrorMessage(err, "Failed to load projects."));
    } finally {
      if (fetchSeqRef.current === seq) setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    if (skipAutoFetchRef.current) { skipAutoFetchRef.current = false; return; }
    const controller = new AbortController();
    void fetchProjects({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchProjects, limit, page]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const onApplyFilters = useCallback(() => {
    skipAutoFetchRef.current = true;
    setPage(1);
    void fetchProjects({ signal: new AbortController().signal, page: 1, limit });
  }, [fetchProjects, limit]);

  const onResetFilters = useCallback(() => {
    skipAutoFetchRef.current = true;
    setPage(1); setLimit(10);
    void fetchProjects({ signal: new AbortController().signal, page: 1, limit: 10 });
  }, [fetchProjects]);

  const stats = [
    { title: "Total Projects", value: total, loading },
    { title: "Showing", value: projects.length, loading },
    { title: "Page", value: `${page} / ${totalPages}`, loading },
    { title: "Page Size", value: limit, loading },
  ];

  return (
    <div className="w-full space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <PageStatsGrid stats={stats} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
              <Input type="text" placeholder="Search" className="h-10 w-full placeholder:text-slate-400" disabled />
              <Input type="text" placeholder="Owner ID" className="h-10 w-full placeholder:text-slate-400" disabled />
              <Select disabled>
                <SelectTrigger className="h-10 w-full" aria-label="Include archived"><SelectValue placeholder="Include archived" /></SelectTrigger>
                <SelectContent><SelectItem value="false">No</SelectItem><SelectItem value="true">Yes</SelectItem></SelectContent>
              </Select>
              <Select disabled>
                <SelectTrigger className="h-10 w-full" aria-label="Archived"><SelectValue placeholder="Archived" /></SelectTrigger>
                <SelectContent><SelectItem value="false">No</SelectItem><SelectItem value="true">Yes</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <Button type="button" onClick={onApplyFilters} disabled={loading} className="h-10 w-full sm:w-auto">Apply Filters</Button>
              <Button type="button" variant="outline" onClick={onResetFilters} disabled={loading} className="h-10 w-full sm:w-auto">Reset Filters</Button>
              <Separator orientation="horizontal" className="sm:hidden" />
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button type="button" className="h-10 w-full sm:w-auto" disabled>Create Project</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          <ProjectsTable
            projects={projects}
            loading={loading}
            onRequestArchive={(p) => { setArchiveProject(p); setArchiveOpen(true); }}
          />
          <TablePagination
            page={page} totalPages={totalPages} hasNext={hasNext}
            limit={limit} showingFrom={showingFrom} showingTo={showingTo}
            total={total} resourceLabel="projects" loading={loading}
            onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </CardContent>
      </Card>

      <AlertDialog open={archiveOpen} onOpenChange={(open) => { setArchiveOpen(open); if (!open) setArchiveProject(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveProject ? `Archive project "${archiveProject.name}"?` : "Archive this project?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" className={buttonVariants({ variant: "destructive" })} onClick={() => { setArchiveOpen(false); setArchiveProject(null); }} disabled>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
