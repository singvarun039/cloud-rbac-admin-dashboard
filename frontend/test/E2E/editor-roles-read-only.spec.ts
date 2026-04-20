import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubEditorApis(page: Page) {
  await page.route('**/api/auth/login', async (route) =>
    json(route, {
      ok: true,
      data: {
        accessToken: 'editor-access-token',
        refreshToken: 'editor-refresh-token',
        user: {
          id: 'editor-1',
          email: 'rbac_editor@rbac.local',
          name: 'Editor',
        },
      },
      requestId: 'req-login-editor',
    })
  );

  await page.route('**/api/auth/me', async (route) =>
    json(route, {
      ok: true,
      data: {
        user: {
          id: 'editor-1',
          email: 'rbac_editor@rbac.local',
          name: 'Editor',
        },
        permissions: ['roles.read', 'permissions.read', 'users.read', 'projects.read', 'audit.read'],
      },
      requestId: 'req-me-editor',
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
      requestId: 'req-dashboard-editor',
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
          topActors: [{ actor: 'rbac_editor@rbac.local', count: 5 }],
          recentFailures: [],
        },
      },
      requestId: 'req-audit-insights-editor',
    })
  );
}

test('editor can read roles but cannot use write/edit actions', async ({ page }) => {
  await stubEditorApis(page);

  await page.route(/\/api\/roles(?:\?.*)?$/, async (route) =>
    json(route, {
      ok: true,
      data: {
        roles: [
          {
            id: 'role-admin',
            name: 'ADMIN',
            description: 'Full system access',
            permissionCount: 11,
          },
          {
            id: 'role-editor',
            name: 'EDITOR',
            description: 'Limited write access',
            permissionCount: 7,
          },
        ],
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
      requestId: 'req-roles-editor',
    })
  );

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_editor@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Roles' }).click();

  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByRole('banner').getByText('Roles', { exact: true })).toBeVisible();
  await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
  await expect(page.getByText('EDITOR', { exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Create Role' })).toBeDisabled();

  await page.getByRole('row', { name: /EDITOR/i }).getByRole('button', { name: /Action/i }).click();

  await expect(page.getByRole('menuitem', { name: 'View' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /Assign Permissions/i })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
});
