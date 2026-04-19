import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { toast } from '../../components/ui/use-toast';
import RoleModal from '../../components/RoleModal';
import AssignPermissionsModal from '../../components/AssignPermissionsModal';
import { NotAuthorized } from '../../components/common/NotAuthorized';
import { PageStatsGrid } from '../../components/common/PageStatsGrid';
import { TablePagination } from '../../components/common/TablePagination';
import { RolesTable } from './RolesTable';
import { RolesRecommendationsDrawer } from './RolesRecommendationsDrawer';
import { RolesDialogs } from './RolesDialogs';
import { RoleViewSheet } from './RoleViewSheet';
import { useRolesPage } from './useRolesPage';

export default function RolesPage() {
  const s = useRolesPage();
  if (!s.canReadRoles) return <NotAuthorized resource="roles" />;

  const stats = [
    { title: 'Total Roles', value: s.total, loading: s.loading },
    { title: 'Showing', value: s.roles.length, loading: s.loading },
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
                void s.fetchRoles();
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <Input
              value={s.searchInput}
              onChange={(e) => s.setSearchInput(e.target.value)}
              placeholder="Search name or description"
              aria-label="Search"
              type="text"
              className="h-10 w-full placeholder:text-slate-400"
            />
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                type="button"
                onClick={s.onApplyFilters}
                disabled={s.loading}
                className="h-10"
              >
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={s.onResetFilters}
                disabled={s.loading}
                className="h-10"
              >
                Reset
              </Button>
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button
                type="button"
                variant="outline"
                onClick={() => s.setShowRecommendations(true)}
                className="h-10"
              >
                AI Recommendations
              </Button>
              <Button
                type="button"
                onClick={() => {
                  s.setSuccess(null);
                  s.setCreateOpen(true);
                }}
                className="h-10"
                disabled={!s.canWriteRoles}
              >
                Create Role
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="pt-6">
          <RolesTable
            roles={s.roles}
            loading={s.loading}
            canReadRoles={s.canReadRoles}
            canWriteRoles={s.canWriteRoles}
            canEditRoles={s.canEditRoles}
            canReadPermissions={s.canReadPermissions}
            onRequestView={(r) => {
              s.setViewRole(r);
              s.setViewOpen(true);
            }}
            onOpenEdit={(r) => {
              s.setSuccess(null);
              s.setEditingRole(r);
              s.setEditOpen(true);
            }}
            onRequestAssign={(r) => {
              s.setAssignConfirmRole(r);
              s.setAssignConfirmOpen(true);
            }}
            onRequestDelete={(r) => {
              if (!s.canWriteRoles) return;
              s.setSuccess(null);
              s.setError(null);
              s.setDeleteRole(r);
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
            resourceLabel="roles"
            loading={s.loading}
            onPageChange={s.setPage}
            onLimitChange={(l) => {
              s.setLimit(l);
              s.setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <RolesDialogs
        assignConfirmOpen={s.assignConfirmOpen}
        onAssignConfirmOpenChange={(open) => {
          s.setAssignConfirmOpen(open);
          if (!open) s.setAssignConfirmRole(null);
        }}
        assignConfirmRole={s.assignConfirmRole}
        onConfirmAssign={(role) => {
          s.setAssignConfirmOpen(false);
          s.setAssigningRole(role);
          s.setAssignOpen(true);
        }}
        deleteOpen={s.deleteOpen}
        onDeleteOpenChange={(open) => {
          s.setDeleteOpen(open);
          if (!open) {
            s.setDeleteRole(null);
            s.setDeleteConfirmText('');
          }
        }}
        deleteRole={s.deleteRole}
        deleteConfirmText={s.deleteConfirmText}
        onDeleteConfirmTextChange={s.setDeleteConfirmText}
        onConfirmDelete={() => void s.onConfirmDelete()}
        deleting={s.deleting}
      />

      <RoleModal
        open={s.createOpen}
        onOpenChange={(open) => {
          if (!open) s.setCreateOpen(false);
        }}
        mode="create"
        onSuccess={() => {
          s.setCreateOpen(false);
          void s.fetchRoles();
          s.setSuccess('Role created.');
          toast.success('Role created');
        }}
      />
      <RoleModal
        open={s.editOpen}
        onOpenChange={(open) => {
          if (!open) {
            s.setEditOpen(false);
            s.setEditingRole(null);
          }
        }}
        mode="edit"
        role={s.editingRole}
        onSuccess={() => {
          s.setEditOpen(false);
          s.setEditingRole(null);
          void s.fetchRoles();
          s.setSuccess('Role updated.');
          toast.success('Role updated');
        }}
      />
      {s.assigningRole ? (
        <AssignPermissionsModal
          open={s.assignOpen}
          role={s.assigningRole}
          canEditRoles={s.canEditRoles}
          canReadPermissions={s.canReadPermissions}
          onClose={() => {
            s.setAssignOpen(false);
            s.setAssigningRole(null);
          }}
          onSuccess={() => {
            s.setAssignOpen(false);
            s.setAssigningRole(null);
            void s.fetchRoles();
            s.setSuccess('Permissions updated.');
            toast.success('Permissions updated');
          }}
          onError={(msg) => {
            s.setError(msg);
            toast.error('Action failed', { description: msg });
          }}
        />
      ) : null}

      <RoleViewSheet
        open={s.viewOpen}
        onOpenChange={(open) => {
          s.setViewOpen(open);
          if (!open) s.setViewRole(null);
        }}
        viewRole={s.viewRole}
      />

      <RolesRecommendationsDrawer
        open={s.showRecommendations}
        onOpenChange={s.setShowRecommendations}
        recommendations={s.recommendations}
        loading={s.recommendationsLoading}
        error={s.recommendationsError}
        onRefresh={() => void s.loadRoleRecommendations({ userInitiated: true })}
      />
    </div>
  );
}
