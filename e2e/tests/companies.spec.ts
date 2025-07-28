import { test, expect } from '../fixtures/auth.fixture';
import { CompaniesPage } from '../helpers/companies.page';
import { TEST_DATA } from '../helpers/constants';

test.describe('Company Management', () => {
  let companiesPage: CompaniesPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    companiesPage = new CompaniesPage(authenticatedPage);
    await companiesPage.goto();
  });

  test('should add a new company', async ({ authenticatedPage }) => {
    const companyName = `Test Company ${Date.now()}`;
    const companyUrl = 'https://example.com';

    // Add company
    await companiesPage.addCompany(companyName, companyUrl);

    // Verify company appears in list
    await expect(authenticatedPage.getByText('Company added successfully')).toBeVisible();
    await expect(await companiesPage.isCompanyVisible(companyName)).toBeTruthy();
  });

  test('should search for companies', async ({ authenticatedPage }) => {
    // Add multiple companies
    const companies = [
      { name: 'Alpha Corp', url: 'https://alpha.com' },
      { name: 'Beta Industries', url: 'https://beta.com' },
      { name: 'Gamma Solutions', url: 'https://gamma.com' },
    ];

    for (const company of companies) {
      await companiesPage.addCompany(company.name, company.url);
      await authenticatedPage.waitForTimeout(500);
    }

    // Search for "Beta"
    await companiesPage.searchCompany('Beta');

    // Only Beta Industries should be visible
    await expect(await companiesPage.isCompanyVisible('Beta Industries')).toBeTruthy();
    await expect(await companiesPage.isCompanyVisible('Alpha Corp')).toBeFalsy();
    await expect(await companiesPage.isCompanyVisible('Gamma Solutions')).toBeFalsy();
  });

  test('should edit company information', async ({ authenticatedPage }) => {
    const originalName = `Original Company ${Date.now()}`;
    const updatedName = `Updated Company ${Date.now()}`;

    // Add company
    await companiesPage.addCompany(originalName, 'https://original.com');

    // Click on company card to edit
    const card = authenticatedPage.locator('[data-testid="company-card"]', { hasText: originalName });
    await card.click();

    // Update company name
    await companiesPage.companyNameInput.clear();
    await companiesPage.companyNameInput.fill(updatedName);
    await companiesPage.saveButton.click();

    // Verify update
    await expect(authenticatedPage.getByText('Company updated successfully')).toBeVisible();
    await expect(await companiesPage.isCompanyVisible(updatedName)).toBeTruthy();
    await expect(await companiesPage.isCompanyVisible(originalName)).toBeFalsy();
  });

  test('should delete a company', async ({ authenticatedPage }) => {
    const companyName = `Delete Me Company ${Date.now()}`;

    // Add company
    await companiesPage.addCompany(companyName, 'https://delete-me.com');
    await expect(await companiesPage.isCompanyVisible(companyName)).toBeTruthy();

    // Delete company
    await companiesPage.deleteCompany(companyName);

    // Verify deletion
    await expect(authenticatedPage.getByText('Company deleted successfully')).toBeVisible();
    await expect(await companiesPage.isCompanyVisible(companyName)).toBeFalsy();
  });

  test('should validate URL format', async ({ authenticatedPage }) => {
    // Try to add company with invalid URL
    await companiesPage.addCompanyButton.click();
    await companiesPage.companyNameInput.fill('Invalid URL Company');
    await companiesPage.companyUrlInput.fill('not-a-valid-url');
    await companiesPage.saveButton.click();

    // Should show validation error
    await expect(authenticatedPage.getByText(/invalid.*url/i)).toBeVisible();
  });

  test('should handle duplicate company names', async ({ authenticatedPage }) => {
    const companyName = `Duplicate Company ${Date.now()}`;

    // Add company
    await companiesPage.addCompany(companyName, 'https://duplicate1.com');
    await expect(authenticatedPage.getByText('Company added successfully')).toBeVisible();

    // Try to add same company name
    await companiesPage.addCompany(companyName, 'https://duplicate2.com');

    // Should show error
    await expect(authenticatedPage.getByText(/already exists/i)).toBeVisible();
  });
});