import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubAdminApis(page: Page) {
  await page.route('**/api/auth/login', async (route) =>
    json(route, {
      ok: true,
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'rbac_admin@rbac.local',
          name: 'Admin',
        },
      },
      requestId: 'req-login',
    })
  );

  await page.route('**/api/auth/me', async (route) =>
    json(route, {
      ok: true,
      data: {
        user: {
          id: 'user-1',
          email: 'rbac_admin@rbac.local',
          name: 'Admin',
        },
        permissions: [
          'users.read',
          'roles.read',
          'roles.edit',
          'roles.write',
          'projects.read',
          'audit.read',
          'permissions.read',
        ],
      },
      requestId: 'req-me',
    })
  );

  await page.route('**/api/dashboard/summary**', async (route) =>
    json(route, {
      ok: true,
      data: {
        kpis: {
          usersTotal: 3,
          rolesTotal: 3,
          projectsTotal: 4,
          auditTotalWindow: 12,
        },
        auditTrend: [
          { date: '2026-04-10', count: 2 },
          { date: '2026-04-11', count: 5 },
        ],
        recentAudit: [],
      },
      requestId: 'req-dashboard',
    })
  );

  await page.route('**/api/ai/audit-insights**', async (route) =>
    json(route, {
      ok: true,
      data: {
        windowDays: 14,
        answer: 'Summary: Access activity looks stable',
        sources: [],
        analytics: {
          totalEvents: 12,
          totalFailures: 1,
          peakDay: { date: '2026-04-11', count: 5 },
          latestDay: { date: '2026-04-11', count: 5 },
          topActions: [{ action: 'LOGIN_SUCCESS', count: 5 }],
          topActors: [{ actor: 'rbac_admin@rbac.local', count: 5 }],
          recentFailures: [],
        },
      },
      requestId: 'req-audit-insights',
    })
  );
}

test('admin can assign a permission to a role from the roles page', async ({ page }) => {
  const replacePermissionPayloads: Array<{ permissionIds: string[] }> = [];
  let rolesListVersion = 0;

  await stubAdminApis(page);

  await page.route(/\/api\/roles\/[^/]+\/permissions$/, async (route) => {
    const payload = route.request().postDataJSON() as { permissionIds: string[] };
    replacePermissionPayloads.push(payload);

    return json(route, {
      ok: true,
      data: {
        role: {
          id: 'role-editor',
          name: 'EDITOR',
          description: 'Limited write access',
        },
      },
      requestId: 'req-replace-permissions',
    });
  });

  await page.route(/\/api\/roles(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());

    if (route.request().method() === 'GET') {
      rolesListVersion += 1;
      return json(route, {
        ok: true,
        data: {
          roles: [
            {
              id: 'role-admin',
              name: 'ADMIN',
              description: 'Full system access',
              permissionCount: 2,
            },
            {
              id: 'role-editor',
              name: 'EDITOR',
              description: 'Limited write access',
              permissions:
                rolesListVersion > 1
                  ? [
                      { id: 'perm-users-read', key: 'users.read' },
                      { id: 'perm-roles-write', key: 'roles.write' },
                    ]
                  : [{ id: 'perm-users-read', key: 'users.read' }],
              permissionCount: rolesListVersion > 1 ? 2 : 1,
            },
          ],
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
        requestId: 'req-roles',
      });
    }

    return route.fallback();
  });

  await page.route('**/api/permissions', async (route) =>
    json(route, {
      ok: true,
      data: {
        permissions: [
          { id: 'perm-users-read', key: 'users.read', description: 'Read users' },
          { id: 'perm-roles-write', key: 'roles.write', description: 'Write roles' },
        ],
      },
      requestId: 'req-permissions',
    })
  );

  await page.route('**/api/ai/policy-simulation', async (route) =>
    json(route, {
      ok: true,
      data: {
        role: {
          id: 'role-editor',
          name: 'EDITOR',
          description: 'Limited write access',
        },
        sources: [
          {
            key: 'ui',
            label: 'UI Access',
            description: 'Route access map',
          },
        ],
        currentPermissionKeys: ['users.read'],
        proposedPermissionKeys: ['users.read', 'roles.write'],
        addedPermissionKeys: ['roles.write'],
        removedPermissionKeys: [],
        impacts: {
          losingAccess: [],
          gainingAccess: [
            {
              kind: 'page',
              key: 'roles',
              label: 'Roles page',
              description: 'Can manage role access',
              requiredAnyOf: ['roles.write'],
            },
          ],
          unchangedAccessible: [],
        },
        summary: 'Granting roles.write unlocks role management.',
      },
      requestId: 'req-policy-simulation',
    })
  );

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill('rbac_admin@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Roles' }).click();

  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByRole('banner').getByText('Roles', { exact: true })).toBeVisible();
  await expect(page.getByText('EDITOR', { exact: true })).toBeVisible();

  await page.getByRole('row', { name: /EDITOR/i }).getByRole('button', { name: /Action/i }).click();
  await page.getByRole('menuitem', { name: /Assign Permissions/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: /Assign permissions: EDITOR/i })).toBeVisible();
  await expect(page.getByText('Selected: 1').first()).toBeVisible();

  const rolesWriteRow = page.locator('label').filter({ hasText: 'roles.write' });
  await rolesWriteRow.locator('input[type="checkbox"]').check();

  await expect(page.getByText('Selected: 2').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(page.getByText('Granting roles.write unlocks role management.')).toBeVisible();

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: /Assign permissions: EDITOR/i })).not.toBeVisible();
  expect(replacePermissionPayloads).toEqual([{ permissionIds: ['perm-roles-write', 'perm-users-read'] }]);
});
