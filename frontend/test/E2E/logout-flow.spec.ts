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
          'roles.read',
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

test('admin can log out from the user menu and returns to the sign-in page', async ({ page }) => {
  let logoutCalls = 0;

  await stubAdminApis(page);
  await page.route('**/api/auth/logout', async (route) => {
    logoutCalls += 1;
    return json(route, { ok: true, data: { success: true }, requestId: 'req-logout' });
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_admin@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(logoutCalls).toBe(1);
});
