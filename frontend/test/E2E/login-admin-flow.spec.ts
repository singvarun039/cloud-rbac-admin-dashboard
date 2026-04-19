import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubAdminFlow(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    const payload = route.request().postDataJSON() as { email?: string; password?: string };

    if (payload?.email === 'rbac_admin@rbac.local' && payload?.password === 'rbac@1234') {
      return json(route, {
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
      });
    }

    return json(
      route,
      {
        ok: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        requestId: 'req-login-fail',
      },
      401
    );
  });

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
          'projects.read',
          'audit.read',
          'roles.write',
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
        recentAudit: [
          {
            id: 'audit-1',
            action: 'LOGIN_SUCCESS',
            entityType: 'User',
            entityId: 'user-1',
            actorUserId: 'user-1',
            actorEmail: 'rbac_admin@rbac.local',
            createdAt: '2026-04-11T10:00:00.000Z',
          },
        ],
      },
      requestId: 'req-dashboard',
    })
  );

  await page.route('**/api/ai/audit-insights**', async (route) =>
    json(route, {
      ok: true,
      data: {
        windowDays: 14,
        answer:
          'Summary: Access activity looks stable\nAnomalies:\n- Small spike in logins\nRecommendations:\n- Review role grants weekly',
        sources: [
          {
            key: 'audit_logs',
            label: 'Audit Logs',
            description: 'Recent audit events',
          },
        ],
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

test('admin can sign in and reach the dashboard shell', async ({ page }) => {
  await stubAdminFlow(page);

  await page.goto('/login');

  await page.getByLabel('Email').fill('rbac_admin@rbac.local');
  await page.getByLabel('Password').fill('rbac@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('banner').getByText('Dashboard', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Users', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Roles', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Projects', { exact: true })).toBeVisible();
  await expect(page.getByText('Audit Events (14d)', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roles' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Audit Logs' })).toBeVisible();
  await expect(page.getByText('Access activity looks stable')).toBeVisible();
});
