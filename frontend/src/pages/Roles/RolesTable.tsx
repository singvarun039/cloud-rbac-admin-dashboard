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
import { ChevronDown, Eye, Pencil, Shield, Trash2 } from 'lucide-react';
import type { Role } from '../../api/roles';

const PROTECTED_ROLE_NAMES = new Set(['ADMIN', 'EDITOR', 'USER', 'VIEWER']);

function permissionCountLabel(role: Role): string {
  const countFromArray = Array.isArray(role.permissions) ? role.permissions.length : null;
  const count =
    typeof countFromArray === 'number'
      ? countFromArray
      : typeof role.permissionCount === 'number'
        ? role.permissionCount
        : 0;
  return `${count} permissions`;
}

interface RolesTableProps {
  roles: Role[];
  loading: boolean;
  canReadRoles: boolean;
  canWriteRoles: boolean;
  canEditRoles: boolean;
  canReadPermissions: boolean;
  onRequestView: (r: Role) => void;
  onOpenEdit: (r: Role) => void;
  onRequestAssign: (r: Role) => void;
  onRequestDelete: (r: Role) => void;
}

export function RolesTable({
  roles,
  loading,
  canReadRoles,
  canWriteRoles,
  canEditRoles,
  canReadPermissions,
  onRequestView,
  onOpenEdit,
  onRequestAssign,
  onRequestDelete,
}: RolesTableProps) {
  const tableHead = (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Description</TableHead>
        <TableHead>Permissions</TableHead>
        <TableHead className="w-[220px] text-right">Actions</TableHead>
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
    );
  }

  if (roles.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">No roles found.</div>;
  }

  return (
    <div className="table-wrap">
      <Table>
        {tableHead}
        <TableBody>
          {roles.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                {r.description ? r.description : <span className="text-sm text-slate-500">-</span>}
              </TableCell>
              <TableCell>{permissionCountLabel(r)}</TableCell>
              <TableCell className="text-right">
                {canReadRoles ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" type="button" className="h-8 px-2">
                        Action <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onRequestView(r)}>
                        <Eye className="mr-2 h-4 w-4" /> View
                      </DropdownMenuItem>

                      {canEditRoles ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => onOpenEdit(r)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => onRequestAssign(r)}
                            disabled={!canReadPermissions}
                          >
                            <Shield className="mr-2 h-4 w-4" /> Assign Permissions
                          </DropdownMenuItem>
                        </>
                      ) : null}

                      {canWriteRoles ? (
                        <>
                          {(() => {
                            const isProtected = PROTECTED_ROLE_NAMES.has(r.name);
                            return (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => onRequestDelete(r)}
                                  disabled={isProtected}
                                  className="text-red-700 focus:bg-red-50 focus:text-red-700 data-[disabled]:text-red-700/50"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {isProtected ? 'Delete (system role)' : 'Delete'}
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
    </div>
  );
}
