import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/client";
import { getProjects, type Project } from "../api/projects";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { buttonVariants } from "../components/ui/button-variants";
import { Card, CardContent } from "../components/ui/card";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Select } from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { StatsCard } from "../components/page/StatsCard";
import { ChevronDown } from "lucide-react";

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

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

  const fetchProjects = useCallback(
    async (opts?: { signal?: AbortSignal; page?: number; limit?: number }) => {
      const seq = ++fetchSeqRef.current;

      const effectivePage = opts?.page ?? page;
      const effectiveLimit = opts?.limit ?? limit;

      setLoading(true);
      setError(null);

      try {
        const res = await getProjects(
          { page: effectivePage, limit: effectiveLimit },
          { signal: opts?.signal },
        );
        if (fetchSeqRef.current !== seq) return;
        setProjects(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load projects."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [limit, page],
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

  const onApplyFilters = useCallback(() => {
    skipAutoFetchRef.current = true;
    setPage(1);
    const controller = new AbortController();
    void fetchProjects({ signal: controller.signal, page: 1, limit });
  }, [fetchProjects, limit]);

  const onResetFilters = useCallback(() => {
    skipAutoFetchRef.current = true;
    setPage(1);
    setLimit(10);
    const controller = new AbortController();
    void fetchProjects({ signal: controller.signal, page: 1, limit: 10 });
  }, [fetchProjects]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRequestArchive = useCallback((p: Project) => {
    setArchiveProject(p);
    setArchiveOpen(true);
  }, []);

  const onConfirmArchive = useCallback(() => {
    // UI pattern only: no archive handler exists on this page.
    setArchiveOpen(false);
    setArchiveProject(null);
  }, []);

  return (
    <div className="w-full space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid w-full grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard title="Total Projects" value={total} loading={loading} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatsCard
            title="Showing"
            value={projects.length}
            loading={loading}
          />
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
                type="text"
                placeholder="Search"
                className="h-10 w-full placeholder:text-slate-400"
                disabled
              />
              <Input
                type="text"
                placeholder="Owner ID"
                className="h-10 w-full placeholder:text-slate-400"
                disabled
              />
              <Select
                defaultValue=""
                className="h-10 w-full"
                disabled
                aria-label="Include archived"
              >
                <option value="" disabled>
                  Include archived
                </option>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
              <Select
                defaultValue=""
                className="h-10 w-full"
                disabled
                aria-label="Archived"
              >
                <option value="" disabled>
                  Archived
                </option>
                <option value="false">No</option>
                <option value="true">Yes</option>
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

              <Button type="button" className="h-10 w-full sm:w-auto" disabled>
                Create Project
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
                  <TableHead>Owner</TableHead>
                  <TableHead>Archived</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[120px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-8 w-10" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : projects.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No projects found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Archived</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[120px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-slate-500">
                      {p.ownerId ?? "-"}
                    </TableCell>
                    <TableCell>{p.isArchived ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-slate-500">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {formatDate(p.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
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
                          <DropdownMenuItem disabled>View</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => onRequestArchive(p)}
                            className="text-red-600 focus:text-red-600"
                            disabled
                          >
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Showing {showingFrom}-{showingTo} of {total} projects
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
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-10 w-[92px]"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={archiveOpen}
        onOpenChange={(open: boolean) => {
          setArchiveOpen(open);
          if (!open) setArchiveProject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveProject
                ? `Archive project "${archiveProject.name}"?`
                : "Archive this project?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={onConfirmArchive}
              disabled
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
