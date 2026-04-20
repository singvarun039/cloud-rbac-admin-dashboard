import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssignPermissions } from '../../src/components/AssignPermissionsModal/useAssignPermissions';
import * as permissionsApi from '../../src/api/permissions';
import * as rolesApi from '../../src/api/roles';
import * as policySimulationApi from '../../src/api/policySimulation';
import * as clientApi from '../../src/api/client';

function HookHarness(props: {
  hookProps: Parameters<typeof useAssignPermissions>[0];
  onSnapshot: (value: ReturnType<typeof useAssignPermissions>) => void;
}) {
  const state = useAssignPermissions(props.hookProps);
  props.onSnapshot(state);
  return null;
}

describe('useAssignPermissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates selected ids from permission keys after loading the catalog', async () => {
    let snapshot: ReturnType<typeof useAssignPermissions> | null = null;

    vi.spyOn(permissionsApi, 'getPermissions').mockResolvedValue({
      data: [
        { id: 'perm-1', key: 'users.read', description: 'Read users' },
        { id: 'perm-2', key: 'roles.write', description: 'Write roles' },
      ],
    });

    render(
      <HookHarness
        hookProps={{
          open: true,
          role: {
            id: 'role-1',
            name: 'Admin',
            description: null,
            permissions: [{ key: 'users.read' }],
          } as any,
          canEditRoles: true,
          canReadPermissions: true,
          onSuccess: vi.fn(),
          onError: vi.fn(),
        }}
        onSnapshot={(value) => {
          snapshot = value;
        }}
      />
    );

    await waitFor(() => expect(snapshot?.selectedIds).toEqual(['perm-1']));
    expect(snapshot?.hydratedFromKeys).toBe(true);
  });

  it('toggles, bulk-selects, simulates, and saves permission changes', async () => {
    let snapshot: ReturnType<typeof useAssignPermissions> | null = null;

    vi.spyOn(permissionsApi, 'getPermissions').mockResolvedValue({
      data: [
        { id: 'perm-1', key: 'users.read', description: 'Read users' },
        { id: 'perm-2', key: 'roles.write', description: 'Write roles' },
      ],
    });
    const simulateSpy = vi
      .spyOn(policySimulationApi, 'simulateRolePolicyChange')
      .mockResolvedValue({ summary: 'No major changes' } as any);
    const replaceSpy = vi
      .spyOn(rolesApi, 'replaceRolePermissions')
      .mockResolvedValue({ role: { id: 'role-1' } } as any);
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    render(
      <HookHarness
        hookProps={{
          open: true,
          role: {
            id: 'role-1',
            name: 'Admin',
            description: null,
            permissions: [{ id: 'perm-1', key: 'users.read' }],
          } as any,
          canEditRoles: true,
          canReadPermissions: true,
          onSuccess,
          onError: vi.fn(),
        }}
        onSnapshot={(value) => {
          snapshot = value;
        }}
      />
    );

    await waitFor(() => expect(snapshot?.loading).toBe(false));

    act(() => {
      snapshot?.setSearch('roles');
    });
    expect(snapshot?.filtered.map((item) => item.id)).toEqual(['perm-2']);

    act(() => {
      snapshot?.onSelectAllFiltered();
    });
    expect(snapshot?.selectedIds).toEqual(['perm-1', 'perm-2']);
    expect(snapshot?.hasChanges).toBe(true);

    await act(async () => {
      await snapshot?.onSimulate();
    });
    expect(simulateSpy).toHaveBeenCalledWith({
      roleId: 'role-1',
      permissionIds: ['perm-1', 'perm-2'],
    });

    await act(async () => {
      await snapshot?.onSave();
    });
    expect(replaceSpy).toHaveBeenCalledWith('role-1', {
      permissionIds: ['perm-1', 'perm-2'],
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('surfaces load and save failures through the provided messages', async () => {
    let snapshot: ReturnType<typeof useAssignPermissions> | null = null;
    const onError = vi.fn();

    vi.spyOn(clientApi, 'getApiErrorMessage').mockReturnValue('Failed to update role permissions.');
    vi.spyOn(permissionsApi, 'getPermissions').mockRejectedValue(new Error('network'));

    render(
      <HookHarness
        hookProps={{
          open: true,
          role: {
            id: 'role-1',
            name: 'Admin',
            description: null,
            permissions: [],
          } as any,
          canEditRoles: true,
          canReadPermissions: true,
          onSuccess: vi.fn(),
          onError,
        }}
        onSnapshot={(value) => {
          snapshot = value;
        }}
      />
    );

    await waitFor(() => expect(snapshot?.loadError).toBe('Failed to update role permissions.'));

    vi.spyOn(permissionsApi, 'getPermissions').mockResolvedValue({
      data: [{ id: 'perm-1', key: 'users.read', description: 'Read users' }],
    });
    vi.spyOn(rolesApi, 'replaceRolePermissions').mockRejectedValue(new Error('network'));

    await act(async () => {
      await snapshot?.fetchPermissions();
    });

    act(() => {
      snapshot?.toggle('perm-1');
    });

    await act(async () => {
      await snapshot?.onSave();
    });

    expect(onError).toHaveBeenCalledWith('Failed to update role permissions.');
  });
});
