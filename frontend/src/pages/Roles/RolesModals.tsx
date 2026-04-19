import { toast } from '../../components/ui/use-toast';
import RoleModal from '../../components/RoleModal';
import AssignPermissionsModal from '../../components/AssignPermissionsModal';
import { RoleViewSheet } from './RoleViewSheet';
import { RolesRecommendationsDrawer } from './RolesRecommendationsDrawer';
import type { useRolesPage } from './useRolesPage';

type RolesPageState = ReturnType<typeof useRolesPage>;

interface RolesModalsProps {
  s: RolesPageState;
}

export function RolesModals({ s }: RolesModalsProps) {
  return (
    <>
      <RoleModal
        open={s.createOpen}
        onClose={() => s.setCreateOpen(false)}
        mode="create"
        canCreate={s.canWriteRoles}
        canEdit={s.canEditRoles}
        onError={(msg) => s.setError(msg)}
        onSuccess={() => {
          s.setCreateOpen(false);
          void s.fetchRoles();
          s.setSuccess('Role created.');
          toast.success('Role created');
        }}
      />
      <RoleModal
        open={s.editOpen}
        onClose={() => {
          s.setEditOpen(false);
          s.setEditingRole(null);
        }}
        mode="edit"
        initialRole={s.editingRole}
        canCreate={s.canWriteRoles}
        canEdit={s.canEditRoles}
        onError={(msg) => s.setError(msg)}
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
    </>
  );
}
