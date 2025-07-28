import { test, expect } from '../fixtures/auth.fixture';
import { CompaniesPage } from '../helpers/companies.page';
import { FormsPage } from '../helpers/forms.page';
import { TEST_DATA } from '../helpers/constants';

test.describe('Submission History', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Create test data
    const companiesPage = new CompaniesPage(authenticatedPage);
    await companiesPage.goto();
    await companiesPage.addCompany(TEST_DATA.company.name, TEST_DATA.company.url);

    // Create template
    await authenticatedPage.goto('/templates');
    await authenticatedPage.getByRole('button', { name: /add.*template/i }).click();
    await authenticatedPage.getByLabel('Template Name').fill(TEST_DATA.template.name);
    await authenticatedPage.getByLabel('Message').fill(TEST_DATA.template.fields.message);
    await authenticatedPage.getByRole('button', { name: /save/i }).click();

    // Make a submission
    const formsPage = new FormsPage(authenticatedPage);
    await formsPage.goto();
    await formsPage.detectForm(TEST_DATA.company.name);
    await formsPage.submitForm(TEST_DATA.template.name);
    await authenticatedPage.waitForTimeout(2000);
  });

  test('should display submission history', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions');

    // Verify submission appears in history
    await expect(authenticatedPage.getByText(TEST_DATA.company.name)).toBeVisible();
    await expect(authenticatedPage.getByText(TEST_DATA.template.name)).toBeVisible();
    
    // Check status indicators
    const statusCell = authenticatedPage.locator('td').filter({ hasText: /success|failed|pending/ });
    await expect(statusCell).toBeVisible();
  });

  test('should filter submissions by status', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions');

    // Apply status filter
    await authenticatedPage.getByRole('combobox', { name: /status/i }).selectOption('success');
    await authenticatedPage.waitForTimeout(500);

    // Verify only successful submissions are shown
    const rows = authenticatedPage.locator('tbody tr');
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      await expect(row.locator('td').filter({ hasText: 'Success' })).toBeVisible();
    }
  });

  test('should filter submissions by date range', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions');

    // Set date range (today)
    const today = new Date().toISOString().split('T')[0];
    await authenticatedPage.getByLabel('Start Date').fill(today);
    await authenticatedPage.getByLabel('End Date').fill(today);
    await authenticatedPage.getByRole('button', { name: /apply.*filter/i }).click();

    // Verify submissions are filtered
    const rows = authenticatedPage.locator('tbody tr');
    await expect(rows).toHaveCount(1); // Should only show today's submission
  });

  test('should show submission details modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions');

    // Click on a submission row
    const row = authenticatedPage.locator('tbody tr').first();
    await row.click();

    // Verify detail modal opens
    await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
    await expect(authenticatedPage.getByText(/submission.*details/i)).toBeVisible();
    
    // Check details content
    await expect(authenticatedPage.getByText(/submitted.*data/i)).toBeVisible();
    await expect(authenticatedPage.getByText(TEST_DATA.template.fields.message)).toBeVisible();
  });

  test('should export submissions to CSV', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions');

    // Create download promise before clicking
    const downloadPromise = authenticatedPage.waitForEvent('download');

    // Click export button
    await authenticatedPage.getByRole('button', { name: /export.*csv/i }).click();

    // Wait for download
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('submissions');
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should display submission statistics', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/submissions');

    // Check statistics cards
    await expect(authenticatedPage.getByText(/total.*submissions/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/success.*rate/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/failed.*submissions/i)).toBeVisible();
    
    // Verify statistics values
    const totalCard = authenticatedPage.locator('[data-testid="total-submissions-stat"]');
    await expect(totalCard).toContainText('1');
  });

  test('should paginate submission history', async ({ authenticatedPage }) => {
    // Create multiple submissions
    const companiesPage = new CompaniesPage(authenticatedPage);
    const formsPage = new FormsPage(authenticatedPage);

    // Add more companies and make submissions
    for (let i = 2; i <= 15; i++) {
      await companiesPage.goto();
      await companiesPage.addCompany(`Company ${i}`, `https://example${i}.com`);
      
      await formsPage.goto();
      await formsPage.detectForm(`Company ${i}`);
      await formsPage.submitForm(TEST_DATA.template.name);
      await authenticatedPage.waitForTimeout(1000);
    }

    await authenticatedPage.goto('/submissions');

    // Check pagination controls
    await expect(authenticatedPage.getByRole('button', { name: /next/i })).toBeVisible();
    await expect(authenticatedPage.getByText(/page.*1.*of/i)).toBeVisible();

    // Navigate to next page
    await authenticatedPage.getByRole('button', { name: /next/i }).click();
    await expect(authenticatedPage.getByText(/page.*2.*of/i)).toBeVisible();
  });
});