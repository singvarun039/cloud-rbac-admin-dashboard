import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEffectivePermissionKeys } from '../../src/utils/rbac';

test('computeEffectivePermissionKeys flattens, de-duplicates, and sorts keys', () => {
  const permissions = computeEffectivePermissionKeys({
    roles: [
      {
        role: {
          permissions: [
            { permission: { key: 'users.write' } },
            { permission: { key: 'users.read' } },
          ],
        },
      },
      {
        role: {
          permissions: [
            { permission: { key: 'users.read' } },
            { permission: { key: 'roles.edit' } },
          ],
        },
      },
    ],
  });

  assert.deepEqual(permissions, ['roles.edit', 'users.read', 'users.write']);
});
