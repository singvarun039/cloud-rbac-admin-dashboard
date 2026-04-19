import { Badge } from '../../components/ui/badge';
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
import { ChevronDown, Eye, Pencil, Trash2, UserX } from 'lucide-react';
import { formatDate } from '../../utils/format';
import type { User } from '../../api/users';

interface RoleText {
  text: string;
  title?: string;
}

interface UsersTableProps {
  users: User[];
  loading: boolean;
  canReadUsers: boolean;
  canWriteUsers: boolean;
  canEditUsers: boolean;
  meId?: string;
  roleTextForUser: (u: User) => RoleText;
  onRequestView: (u: User) => void;
  onOpenEdit: (u: User) => void;
  onRequestDeactivate: (u: User) => void;
  onRequestDelete: (u: User) => void;
}

export function UsersTable({
  users,
  loading,
  canReadUsers,
  canWriteUsers,
  canEditUsers,
  meId,
  roleTextForUser,
  onRequestView,
  onOpenEdit,
  onRequestDeactivate,
  onRequestDelete,
}: UsersTableProps) {
  const tableHead = (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Created</TableHead>
        <TableHead className="w-[170px] text-right">Actions</TableHead>
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
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-44" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (users.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">No users found.</div>;
  }

  return (
    <Table>
      {tableHead}
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">{u.name}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>
              {(() => {
                const role = roleTextForUser(u);
                return <span title={role.title}>{role.text}</span>;
              })()}
            </TableCell>
            <TableCell>
              <Badge variant={u.status === 'ACTIVE' ? 'success' : 'destructive'}>{u.status}</Badge>
            </TableCell>
            <TableCell>{formatDate(u.createdAt)}</TableCell>
            <TableCell className="text-right">
              {canReadUsers ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" type="button" className="h-8 px-2">
                      Action <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onRequestView(u)}>
                      <Eye className="mr-2 h-4 w-4" /> View
                    </DropdownMenuItem>

                    {canEditUsers ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onOpenEdit(u)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      </>
                    ) : null}

                    {canWriteUsers ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => onRequestDeactivate(u)}
                          className="text-red-700 focus:bg-red-50 focus:text-red-700"
                        >
                          <UserX className="mr-2 h-4 w-4" /> Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onRequestDelete(u)}
                          disabled={Boolean(meId && meId === u.id)}
                          className="text-red-700 focus:bg-red-50 focus:text-red-700"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
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
  );
}
