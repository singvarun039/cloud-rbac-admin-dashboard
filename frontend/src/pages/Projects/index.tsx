import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Card, CardContent } from '../../components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { PageStatsGrid } from '../../components/common/PageStatsGrid';
import { TablePagination } from '../../components/common/TablePagination';
import { ProjectsTable } from './ProjectsTable';
import { useProjectsPage } from './useProjectsPage';

export default function ProjectsPage() {
  const p = useProjectsPage();

  const stats = [
    { title: 'Total Projects', value: p.total, loading: p.loading },
    { title: 'Showing', value: p.projects.length, loading: p.loading },
    { title: 'Page', value: `${p.page} / ${p.totalPages}`, loading: p.loading },
    { title: 'Page Size', value: p.limit, loading: p.loading },
  ];

  return (
    <div className="w-full space-y-4">
      {p.error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{p.error}</AlertDescription>
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
                <SelectTrigger className="h-10 w-full" aria-label="Include archived">
                  <SelectValue placeholder="Include archived" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
              <Select disabled>
                <SelectTrigger className="h-10 w-full" aria-label="Archived">
                  <SelectValue placeholder="Archived" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <Button type="button" onClick={p.onApplyFilters} disabled={p.loading} className="h-10 w-full sm:w-auto">
                Apply Filters
              </Button>
              <Button type="button" variant="outline" onClick={p.onResetFilters} disabled={p.loading} className="h-10 w-full sm:w-auto">
                Reset Filters
              </Button>
              <Separator orientation="horizontal" className="sm:hidden" />
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button type="button" className="h-10 w-full sm:w-auto" disabled>
                Create Project
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          <ProjectsTable
            projects={p.projects}
            loading={p.loading}
            onRequestArchive={(proj) => {
              p.setArchiveProject(proj);
              p.setArchiveOpen(true);
            }}
          />
          <TablePagination
            page={p.page}
            totalPages={p.totalPages}
            hasNext={p.hasNext}
            limit={p.limit}
            showingFrom={p.showingFrom}
            showingTo={p.showingTo}
            total={p.total}
            resourceLabel="projects"
            loading={p.loading}
            onPageChange={p.setPage}
            onLimitChange={(l) => {
              p.setLimit(l);
              p.setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={p.archiveOpen}
        onOpenChange={(open) => {
          p.setArchiveOpen(open);
          if (!open) p.setArchiveProject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project?</AlertDialogTitle>
            <AlertDialogDescription>
              {p.archiveProject ? `Archive project "${p.archiveProject.name}"?` : 'Archive this project?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                p.setArchiveOpen(false);
                p.setArchiveProject(null);
              }}
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
