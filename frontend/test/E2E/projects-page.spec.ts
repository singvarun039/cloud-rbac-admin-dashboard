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
        permissions: ['projects.read', 'users.read', 'roles.read', 'audit.read'],
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
        auditTrend: null,
        recentAudit: null,
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

test('admin can open the projects page and see seeded project rows', async ({ page }) => {
  await stubAdminApis(page);

  await page.route(/\/api\/projects(?:\?.*)?$/, async (route) =>
    json(route, {
      ok: true,
      data: {
        items: [
          {
            id: 'project-1',
            name: 'Platform Core',
            ownerId: 'user-1',
            isArchived: false,
            createdAt: '2026-04-09T10:00:00.000Z',
            updatedAt: '2026-04-11T10:00:00.000Z',
          },
          {
            id: 'project-2',
            name: 'Legacy API',
            ownerId: 'user-1',
            isArchived: true,
            createdAt: '2026-04-08T10:00:00.000Z',
            updatedAt: '2026-04-10T10:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          hasNext: false,
        },
      },
      requestId: 'req-projects',
    })
  );

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_admin@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Projects' }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('banner').getByText('Projects', { exact: true })).toBeVisible();
  await expect(page.getByText('Platform Core', { exact: true })).toBeVisible();
  await expect(page.getByText('Legacy API', { exact: true })).toBeVisible();
  await expect(page.getByText('Yes', { exact: true })).toBeVisible();
  await expect(page.getByText('No', { exact: true })).toBeVisible();
});
