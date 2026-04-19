import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ChevronDown } from 'lucide-react';
import { formatDate } from '../../utils/format';
import type { Project } from '../../api/projects';

interface ProjectsTableProps {
  projects: Project[];
  loading: boolean;
  onRequestArchive: (p: Project) => void;
}

export function ProjectsTable({ projects, loading, onRequestArchive }: ProjectsTableProps) {
  const tableHead = (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Owner</TableHead>
        <TableHead>Archived</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead className="w-[120px] text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );

  if (loading) {
    return (
      <Table>
        {tableHead}
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
    );
  }

  if (projects.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">No projects found.</div>;
  }

  return (
    <div className="table-wrap">
      <Table>
        {tableHead}
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-slate-500">{p.ownerId ?? '-'}</TableCell>
              <TableCell>{p.isArchived ? 'Yes' : 'No'}</TableCell>
              <TableCell className="text-slate-500">{formatDate(p.createdAt)}</TableCell>
              <TableCell className="text-slate-500">{formatDate(p.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" type="button" className="h-8 px-2">
                      Action <ChevronDown className="ml-1 h-4 w-4" />
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
    </div>
  );
}
