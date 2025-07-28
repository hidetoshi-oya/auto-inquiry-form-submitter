import { test, expect } from '../fixtures/auth.fixture';
import { CompaniesPage } from '../helpers/companies.page';
import { TEST_DATA } from '../helpers/constants';

test.describe('Batch Submission', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Add multiple companies
    const companiesPage = new CompaniesPage(authenticatedPage);
    await companiesPage.goto();

    for (let i = 1; i <= 3; i++) {
      await companiesPage.addCompany(
        `Test Company ${i}`,
        `https://example${i}.com`
      );
      await authenticatedPage.waitForTimeout(500);
    }

    // Create a template
    await authenticatedPage.goto('/templates');
    await authenticatedPage.getByRole('button', { name: /add.*template/i }).click();
    await authenticatedPage.getByLabel('Template Name').fill('Batch Template');
    await authenticatedPage.getByLabel('Message').fill('Test batch message');
    await authenticatedPage.getByRole('button', { name: /save/i }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test('should create and execute batch submission', async ({ authenticatedPage }) => {
    // Go to batch submission page
    await authenticatedPage.goto('/submissions/batch');

    // Select multiple companies
    await authenticatedPage.getByRole('checkbox', { name: 'Test Company 1' }).check();
    await authenticatedPage.getByRole('checkbox', { name: 'Test Company 2' }).check();
    await authenticatedPage.getByRole('checkbox', { name: 'Test Company 3' }).check();

    // Select template
    await authenticatedPage.getByLabel('Select Template').selectOption('Batch Template');

    // Set submission interval
    await authenticatedPage.getByLabel('Submission Interval (seconds)').fill('5');

    // Start batch submission
    await authenticatedPage.getByRole('button', { name: /start.*batch/i }).click();

    // Wait for batch to complete (with progress indicators)
    await expect(authenticatedPage.getByText(/processing.*1.*of.*3/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/batch.*completed/i)).toBeVisible({ timeout: 30000 });

    // Verify all submissions in history
    await authenticatedPage.goto('/submissions');
    const rows = authenticatedPage.locator('tbody tr');
    await expect(rows).toHaveCount(3);
  });

  test('should handle batch submission errors', async ({ authenticatedPage }) => {
    // Add a company with invalid URL
    const companiesPage = new CompaniesPage(authenticatedPage);
    await companiesPage.goto();
    await companiesPage.addCompany('Invalid Company', 'https://invalid-site-12345.com');

    // Create batch with mix of valid and invalid companies
    await authenticatedPage.goto('/submissions/batch');
    await authenticatedPage.getByRole('checkbox', { name: 'Test Company 1' }).check();
    await authenticatedPage.getByRole('checkbox', { name: 'Invalid Company' }).check();
    
    await authenticatedPage.getByLabel('Select Template').selectOption('Batch Template');
    await authenticatedPage.getByRole('button', { name: /start.*batch/i }).click();

    // Should complete with partial success
    await expect(authenticatedPage.getByText(/batch.*completed.*errors/i)).toBeVisible({ timeout: 30000 });
    
    // Check error details
    await authenticatedPage.getByRole('button', { name: /view.*errors/i }).click();
    await expect(authenticatedPage.getByText('Invalid Company')).toBeVisible();
    await expect(authenticatedPage.getByText(/failed/i)).toBeVisible();
  });

  test('should respect rate limiting in batch submissions', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions/batch');

    // Select companies
    await authenticatedPage.getByRole('checkbox', { name: 'Test Company 1' }).check();
    await authenticatedPage.getByRole('checkbox', { name: 'Test Company 2' }).check();

    // Set very short interval to trigger rate limiting
    await authenticatedPage.getByLabel('Submission Interval (seconds)').fill('0.1');

    await authenticatedPage.getByLabel('Select Template').selectOption('Batch Template');
    await authenticatedPage.getByRole('button', { name: /start.*batch/i }).click();

    // Should show rate limit warning
    await expect(authenticatedPage.getByText(/rate.*limit.*adjusted/i)).toBeVisible();
  });
});