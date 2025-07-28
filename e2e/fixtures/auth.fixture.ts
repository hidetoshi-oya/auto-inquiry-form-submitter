import { test as base } from '@playwright/test';
import { LoginPage } from '../helpers/login.page';
import { API_BASE_URL } from '../helpers/constants';

type AuthFixtures = {
  authenticatedPage: any;
  loginPage: LoginPage;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Create test user
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    // Register user via API
    const response = await page.request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    if (!response.ok()) {
      throw new Error('Failed to create test user');
    }

    const { access_token } = await response.json();

    // Set authentication token
    await page.context().addCookies([
      {
        name: 'access_token',
        value: access_token,
        domain: new URL(page.url() || 'http://localhost:5173').hostname,
        path: '/',
      },
    ]);

    // Set authorization header for API requests
    await page.setExtraHTTPHeaders({
      Authorization: `Bearer ${access_token}`,
    });

    await use(page);

    // Cleanup - Delete test user if needed
    try {
      await page.request.delete(`${API_BASE_URL}/api/auth/user`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  },

  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
});

export { expect } from '@playwright/test';