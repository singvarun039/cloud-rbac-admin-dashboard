import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionCatalog } from '../../src/components/AssignPermissionsModal/PermissionCatalog';

describe('PermissionCatalog', () => {
  it('renders counts and forwards search/select actions', () => {
    const setSearch = vi.fn();
    const toggle = vi.fn();
    const onSelectAllFiltered = vi.fn();
    const onClearFiltered = vi.fn();

    render(
      <PermissionCatalog
        catalog={[
          { id: 'perm-1', key: 'users.read', description: 'Read users' },
          { id: 'perm-2', key: 'roles.write', description: 'Write roles' },
        ]}
        filtered={[{ id: 'perm-2', key: 'roles.write', description: 'Write roles' }]}
        loading={false}
        search=""
        setSearch={setSearch}
        selectedIds={['perm-2']}
        selectedSet={new Set(['perm-2'])}
        changedCount={1}
        hydratedFromKeys
        canEditRoles
        submitting={false}
        role={{ id: 'role-1', name: 'Admin' }}
        toggle={toggle}
        onSelectAllFiltered={onSelectAllFiltered}
        onClearFiltered={onClearFiltered}
      />
    );

    expect(screen.getByText('Permission catalog')).toBeTruthy();
    expect(screen.getByText('Hydrated from keys')).toBeTruthy();
    expect(screen.getByText('Visible: 1')).toBeTruthy();
    expect(screen.getByText('Selected: 1')).toBeTruthy();
    expect(screen.getByText('Added since open: 1')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('filter by key or description'), {
      target: { value: 'roles' },
    });
    expect(setSearch).toHaveBeenCalledWith('roles');

    fireEvent.click(screen.getByText('Select visible'));
    fireEvent.click(screen.getByText('Clear visible'));
    fireEvent.click(screen.getByRole('checkbox'));

    expect(onSelectAllFiltered).toHaveBeenCalledTimes(1);
    expect(onClearFiltered).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledWith('perm-2');
  });
});
