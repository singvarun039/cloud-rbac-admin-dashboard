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
          'users.write',
          'users.edit',
          'roles.read',
          'roles.write',
          'roles.edit',
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

test('admin can filter users and open the user details sheet', async ({ page }) => {
  const userQueries: string[] = [];

  await stubAdminApis(page);

  await page.route(/\/api\/users(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search') ?? '';
    userQueries.push(search);

    const filteredUsers =
      search.toLowerCase() === 'viewer'
        ? [
            {
              id: 'user-viewer',
              name: 'Viewer User',
              email: 'rbac_viewer@rbac.local',
              status: 'ACTIVE',
              roles: [{ id: 'role-viewer', name: 'VIEWER' }],
              createdAt: '2026-04-10T10:00:00.000Z',
              updatedAt: '2026-04-11T10:00:00.000Z',
            },
          ]
        : [
            {
              id: 'user-admin',
              name: 'Admin User',
              email: 'rbac_admin@rbac.local',
              status: 'ACTIVE',
              roles: [{ id: 'role-admin', name: 'ADMIN' }],
              createdAt: '2026-04-09T10:00:00.000Z',
              updatedAt: '2026-04-11T10:00:00.000Z',
            },
            {
              id: 'user-viewer',
              name: 'Viewer User',
              email: 'rbac_viewer@rbac.local',
              status: 'ACTIVE',
              roles: [{ id: 'role-viewer', name: 'VIEWER' }],
              createdAt: '2026-04-10T10:00:00.000Z',
              updatedAt: '2026-04-11T10:00:00.000Z',
            },
          ];

    return json(route, {
      ok: true,
      data: {
        items: filteredUsers,
        meta: {
          page: 1,
          limit: 10,
          total: filteredUsers.length,
          hasNext: false,
        },
      },
      requestId: 'req-users',
    });
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_admin@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Users' }).click();

  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('banner').getByText('Users', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin User', { exact: true })).toBeVisible();
  await expect(page.getByText('Viewer User', { exact: true })).toBeVisible();

  await page.getByLabel('Search').fill('viewer');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page.getByText('Viewer User', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin User', { exact: true })).toHaveCount(0);

  await page.getByRole('row', { name: /Viewer User/i }).getByRole('button', { name: /Action/i }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();

  await expect(page.getByText('User details', { exact: true })).toBeVisible();
  await expect(page.getByText('rbac_viewer@rbac.local', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('VIEWER', { exact: true }).last()).toBeVisible();

  expect(userQueries).toContain('');
  expect(userQueries).toContain('viewer');
});
