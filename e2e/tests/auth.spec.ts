import { test, expect } from '@playwright/test';
import { LoginPage } from '../helpers/login.page';
import { API_BASE_URL, APP_BASE_URL } from '../helpers/constants';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should register a new user', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    await page.goto(`${APP_BASE_URL}/register`);
    
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: 'Register' }).click();

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Should show user email in navbar
    await expect(page.getByText(email)).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // First create a user via API
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    await page.request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, password },
    });

    // Now test login
    await loginPage.goto();
    await loginPage.login(email, password);

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByText(email)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('invalid@example.com', 'wrongpassword');

    // Should show error message
    const hasError = await loginPage.expectError('Invalid credentials');
    expect(hasError).toBeTruthy();
  });

  test('should logout successfully', async ({ page }) => {
    // Create and login user
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    const response = await page.request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, password },
    });
    const { access_token } = await response.json();

    await page.context().addCookies([
      {
        name: 'access_token',
        value: access_token,
        domain: new URL(APP_BASE_URL).hostname,
        path: '/',
      },
    ]);

    await page.goto(`${APP_BASE_URL}/dashboard`);
    await expect(page.getByText(email)).toBeVisible();

    // Logout
    await page.getByRole('button', { name: /logout/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login/);
  });
});