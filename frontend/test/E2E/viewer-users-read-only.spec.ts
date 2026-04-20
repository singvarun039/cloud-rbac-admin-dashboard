import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubViewerApis(page: Page) {
  await page.route('**/api/auth/login', async (route) =>
    json(route, {
      ok: true,
      data: {
        accessToken: 'viewer-access-token',
        refreshToken: 'viewer-refresh-token',
        user: {
          id: 'viewer-1',
          email: 'rbac_viewer@rbac.local',
          name: 'Viewer',
        },
      },
      requestId: 'req-login-viewer',
    })
  );

  await page.route('**/api/auth/me', async (route) =>
    json(route, {
      ok: true,
      data: {
        user: {
          id: 'viewer-1',
          email: 'rbac_viewer@rbac.local',
          name: 'Viewer',
        },
        permissions: ['users.read', 'projects.read'],
      },
      requestId: 'req-me-viewer',
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
        auditTrend: null,
        recentAudit: null,
      },
      requestId: 'req-dashboard-viewer',
    })
  );
}

test('viewer can open users page in read-only mode without write actions', async ({ page }) => {
  await stubViewerApis(page);

  await page.route(/\/api\/users(?:\?.*)?$/, async (route) =>
    json(route, {
      ok: true,
      data: {
        items: [
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
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          hasNext: false,
        },
      },
      requestId: 'req-users-viewer',
    })
  );

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_viewer@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Users' }).click();

  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('banner').getByText('Users', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create User' })).toBeDisabled();
  await expect(page.getByText('Admin User', { exact: true })).toBeVisible();
  await expect(page.getByText('Viewer User', { exact: true })).toBeVisible();

  await page.getByRole('row', { name: /Viewer User/i }).getByRole('button', { name: /Action/i }).click();

  await expect(page.getByRole('menuitem', { name: 'View' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Deactivate' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
});
