import { test, expect } from '../fixtures/auth.fixture';
import { CompaniesPage } from '../helpers/companies.page';

test.describe('Compliance Features', () => {
  let companiesPage: CompaniesPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    companiesPage = new CompaniesPage(authenticatedPage);
  });

  test('should check robots.txt compliance', async ({ authenticatedPage }) => {
    // Add a company
    await companiesPage.goto();
    await companiesPage.addCompany('Compliance Test', 'https://www.google.com');

    // Go to compliance check
    await authenticatedPage.goto('/companies');
    const companyCard = authenticatedPage.locator('[data-testid="company-card"]', { hasText: 'Compliance Test' });
    await companyCard.getByRole('button', { name: /check.*compliance/i }).click();

    // Should show robots.txt status
    await expect(authenticatedPage.getByText(/robots.txt.*status/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/allowed|disallowed/i)).toBeVisible();
  });

  test('should detect and warn about ToS violations', async ({ authenticatedPage }) => {
    // Add a company with strict ToS
    await companiesPage.goto();
    await companiesPage.addCompany('Strict ToS Site', 'https://www.facebook.com');

    // Try to submit to this company
    await authenticatedPage.goto('/forms');
    await authenticatedPage.getByLabel('Select Company').selectOption('Strict ToS Site');
    await authenticatedPage.getByRole('button', { name: /detect.*form/i }).click();

    // Should show ToS warning
    await expect(authenticatedPage.getByText(/terms.*service.*warning/i)).toBeVisible({ timeout: 15000 });
  });

  test('should enforce rate limiting', async ({ authenticatedPage }) => {
    // Add multiple companies
    for (let i = 1; i <= 5; i++) {
      await companiesPage.goto();
      await companiesPage.addCompany(`Rate Test ${i}`, `https://example${i}.com`);
    }

    // Try rapid form detection
    await authenticatedPage.goto('/forms');
    
    // Attempt multiple rapid detections
    for (let i = 1; i <= 5; i++) {
      await authenticatedPage.getByLabel('Select Company').selectOption(`Rate Test ${i}`);
      await authenticatedPage.getByRole('button', { name: /detect.*form/i }).click();
      
      if (i < 5) {
        // Don't wait on the last one
        await authenticatedPage.waitForTimeout(100);
      }
    }

    // Should show rate limit warning
    await expect(authenticatedPage.getByText(/rate.*limit|slow.*down/i)).toBeVisible();
  });

  test('should respect user agent settings', async ({ authenticatedPage }) => {
    // Go to settings
    await authenticatedPage.goto('/settings');
    
    // Check user agent configuration
    await expect(authenticatedPage.getByLabel(/user.*agent/i)).toBeVisible();
    const userAgentInput = authenticatedPage.getByLabel(/user.*agent/i);
    
    // Verify default user agent
    const defaultUA = await userAgentInput.inputValue();
    expect(defaultUA).toContain('AutoInquiryBot');
  });

  test('should show compliance statistics', async ({ authenticatedPage }) => {
    // Add companies and check compliance
    await companiesPage.goto();
    await companiesPage.addCompany('Google', 'https://www.google.com');
    await companiesPage.addCompany('GitHub', 'https://github.com');

    // Go to compliance dashboard
    await authenticatedPage.goto('/compliance');

    // Check statistics
    await expect(authenticatedPage.getByText(/compliance.*overview/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/robots.txt.*compliant/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/rate.*limited/i)).toBeVisible();
  });

  test('should validate form submission against compliance rules', async ({ authenticatedPage }) => {
    // Add a company
    await companiesPage.goto();
    await companiesPage.addCompany('Test Company', 'https://example.com');

    // Create template with potential spam content
    await authenticatedPage.goto('/templates');
    await authenticatedPage.getByRole('button', { name: /add.*template/i }).click();
    await authenticatedPage.getByLabel('Template Name').fill('Spam Template');
    await authenticatedPage.getByLabel('Message').fill('Buy now! Limited offer! Click here!!!');
    await authenticatedPage.getByRole('button', { name: /save/i }).click();

    // Try to submit with spam template
    await authenticatedPage.goto('/forms');
    await authenticatedPage.getByLabel('Select Company').selectOption('Test Company');
    await authenticatedPage.getByRole('button', { name: /detect.*form/i }).click();
    await authenticatedPage.waitForTimeout(2000);
    
    await authenticatedPage.getByLabel('Select Template').selectOption('Spam Template');
    await authenticatedPage.getByRole('button', { name: /submit.*form/i }).click();

    // Should show spam warning
    await expect(authenticatedPage.getByText(/spam.*detected|compliance.*warning/i)).toBeVisible();
  });
});