import { expect, test, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test('invalid login shows server error and stays on the sign-in page', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) =>
    json(
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
    )
  );

  await page.goto('/login');
  await page.getByLabel('Email').fill('rbac_admin@rbac.local');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Sign-in failed')).toBeVisible();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
});
