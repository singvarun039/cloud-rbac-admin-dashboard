import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubLimitedViewerApis(page: Page) {
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

test('viewer sees limited navigation and gets forbidden state on restricted routes', async ({
  page,
}) => {
  await stubLimitedViewerApis(page);

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_viewer@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roles' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);

  await page.goto('/roles');

  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByRole('heading', { name: 'Roles', exact: true })).toBeVisible();
  await expect(page.getByText('Forbidden (403)', { exact: true })).toBeVisible();
  await expect(page.getByText('You don’t have permission to view roles.')).toBeVisible();
});
