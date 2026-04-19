import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Card, CardContent } from '../../components/ui/card';
import { toast } from '../../components/ui/use-toast';
import { NotAuthorized } from '../../components/common/NotAuthorized';
import { PageStatsGrid } from '../../components/common/PageStatsGrid';
import { TablePagination } from '../../components/common/TablePagination';
import { UsersTable } from './UsersTable';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { UsersDialogs } from './UsersDialogs';
import { UserViewSheet } from './UserViewSheet';
import { useUsersPage } from './useUsersPage';

export default function UsersPage() {
  const s = useUsersPage();
  if (!s.canReadUsers) return <NotAuthorized resource="users" />;

  const stats = [
    { title: 'Total Users', value: s.total, loading: s.loading },
    { title: 'Showing', value: s.users.length, loading: s.loading },
    { title: 'Page', value: `${s.page} / ${s.totalPages}`, loading: s.loading },
    { title: 'Page Size', value: s.limit, loading: s.loading },
  ];

  return (
    <div className="w-full space-y-4">
      {s.success ? (
        <Alert variant="success">
          <AlertDescription>{s.success}</AlertDescription>
        </Alert>
      ) : null}
      {s.error ? (
        <Alert variant="destructive">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AlertDescription className="sm:pr-4">{s.error}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                s.setSuccess(null);
                void s.fetchUsers();
              }}
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      <PageStatsGrid stats={stats} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
              <Input
                value={s.searchInput}
                onChange={(e) => s.setSearchInput(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search"
                type="text"
                className="h-10 w-full placeholder:text-slate-400 lg:col-span-2"
              />
              <Select
                value={s.statusInput}
                onValueChange={(value) => s.setStatusInput(value as typeof s.statusInput)}
              >
                <SelectTrigger aria-label="Status" className="h-10 w-full lg:col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <Button
                type="button"
                onClick={s.onApplyFilters}
                disabled={s.loading}
                className="h-10 w-full sm:w-auto"
              >
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={s.onResetFilters}
                disabled={s.loading}
                className="h-10 w-full sm:w-auto"
              >
                Reset Filters
              </Button>
              <Separator orientation="horizontal" className="sm:hidden" />
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button
                type="button"
                onClick={() => {
                  s.setSuccess(null);
                  s.setCreateOpen(true);
                }}
                className="h-10 w-full sm:w-auto"
                disabled={!s.canWriteUsers}
              >
                Create User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          <UsersTable
            users={s.users}
            loading={s.loading}
            canReadUsers={s.canReadUsers}
            canWriteUsers={s.canWriteUsers}
            canEditUsers={s.canEditUsers}
            meId={s.me?.id}
            roleTextForUser={s.roleTextForUser}
            onRequestView={(u) => {
              s.setViewUser(u);
              s.setViewOpen(true);
            }}
            onOpenEdit={(u) => {
              s.setSuccess(null);
              s.setEditingUser(u);
              s.setEditOpen(true);
            }}
            onRequestDeactivate={(u) => {
              s.setDeactivateTarget(u);
              s.setDeactivateOpen(true);
            }}
            onRequestDelete={(u) => {
              s.setDeleteTarget(u);
              s.setDeleteConfirmText('');
              s.setDeleteOpen(true);
            }}
          />
          <TablePagination
            page={s.page}
            totalPages={s.totalPages}
            hasNext={s.hasNext}
            limit={s.limit}
            showingFrom={s.showingFrom}
            showingTo={s.showingTo}
            total={s.total}
            resourceLabel="users"
            loading={s.loading}
            onPageChange={s.setPage}
            onLimitChange={(newLimit) => {
              s.setLimit(newLimit);
              s.setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <UsersDialogs
        deactivateOpen={s.deactivateOpen}
        onDeactivateOpenChange={(open) => {
          s.setDeactivateOpen(open);
          if (!open) s.setDeactivateTarget(null);
        }}
        deactivateTarget={s.deactivateTarget}
        onConfirmDeactivate={s.onConfirmDeactivate}
        deleteOpen={s.deleteOpen}
        onDeleteOpenChange={(open) => {
          s.setDeleteOpen(open);
          if (!open) {
            s.setDeleteTarget(null);
            s.setDeleteConfirmText('');
          }
        }}
        deleteTarget={s.deleteTarget}
        deleteConfirmText={s.deleteConfirmText}
        onDeleteConfirmTextChange={s.setDeleteConfirmText}
        onConfirmDelete={() => void s.onConfirmDelete()}
        meId={s.me?.id}
      />

      <CreateUserModal
        isOpen={s.createOpen}
        onClose={() => s.setCreateOpen(false)}
        canWrite={s.canWriteUsers}
        onCreated={async () => {
          s.setCreateOpen(false);
          s.setPage(1);
          await s.fetchUsers();
          s.setSuccess('User created.');
          toast.success('User created');
        }}
        onError={(msg) => {
          s.setError(msg);
          toast.error('Action failed', { description: msg });
        }}
      />
      <EditUserModal
        isOpen={s.editOpen}
        onClose={() => {
          s.setEditOpen(false);
          s.setEditingUser(null);
        }}
        canEdit={s.canEditUsers}
        user={s.editingUser}
        onUpdated={async () => {
          s.setEditOpen(false);
          s.setEditingUser(null);
          await s.fetchUsers();
          s.setSuccess('User updated.');
          toast.success('User updated');
        }}
        onError={(msg) => {
          s.setError(msg);
          toast.error('Action failed', { description: msg });
        }}
      />
      <UserViewSheet
        open={s.viewOpen}
        onOpenChange={(open) => {
          s.setViewOpen(open);
          if (!open) s.setViewUser(null);
        }}
        viewUser={s.viewUser}
        roleTextForUser={s.roleTextForUser}
      />
    </div>
  );
}
