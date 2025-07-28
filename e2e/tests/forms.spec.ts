import { test, expect } from '../fixtures/auth.fixture';
import { CompaniesPage } from '../helpers/companies.page';
import { FormsPage } from '../helpers/forms.page';
import { TEST_DATA } from '../helpers/constants';

test.describe('Form Detection and Submission', () => {
  let companiesPage: CompaniesPage;
  let formsPage: FormsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    companiesPage = new CompaniesPage(authenticatedPage);
    formsPage = new FormsPage(authenticatedPage);

    // Add a test company
    await companiesPage.goto();
    await companiesPage.addCompany(TEST_DATA.company.name, TEST_DATA.company.url);
    await authenticatedPage.waitForTimeout(1000);
  });

  test('should detect forms on company website', async ({ authenticatedPage }) => {
    await formsPage.goto();

    // Start form detection
    await formsPage.detectForm(TEST_DATA.company.name);

    // Verify forms were detected
    const formCount = await formsPage.getDetectedFormsCount();
    expect(formCount).toBeGreaterThan(0);

    // Check form details are displayed
    await expect(authenticatedPage.getByText(/contact.*form/i)).toBeVisible();
  });

  test('should handle form detection errors gracefully', async ({ authenticatedPage }) => {
    // Add company with invalid URL
    await companiesPage.goto();
    await companiesPage.addCompany('Invalid Site', 'https://this-site-does-not-exist-12345.com');

    await formsPage.goto();
    await formsPage.detectForm('Invalid Site');

    // Should show error message
    await expect(authenticatedPage.getByText(/failed.*detect.*form/i)).toBeVisible();
  });

  test('should submit form with template', async ({ authenticatedPage }) => {
    // First create a template
    await authenticatedPage.goto('/templates');
    await authenticatedPage.getByRole('button', { name: /add.*template/i }).click();
    
    await authenticatedPage.getByLabel('Template Name').fill(TEST_DATA.template.name);
    await authenticatedPage.getByLabel('Category').selectOption(TEST_DATA.template.category);
    await authenticatedPage.getByLabel('Company Name Field').fill(TEST_DATA.template.fields.company_name);
    await authenticatedPage.getByLabel('Contact Name').fill(TEST_DATA.template.fields.contact_name);
    await authenticatedPage.getByLabel('Email').fill(TEST_DATA.template.fields.email);
    await authenticatedPage.getByLabel('Message').fill(TEST_DATA.template.fields.message);
    await authenticatedPage.getByRole('button', { name: /save/i }).click();

    // Detect forms
    await formsPage.goto();
    await formsPage.detectForm(TEST_DATA.company.name);

    // Submit form
    await formsPage.submitForm(TEST_DATA.template.name);

    // Verify submission
    const isSuccessful = await formsPage.isSubmissionSuccessful();
    expect(isSuccessful).toBeTruthy();
  });

  test('should handle CAPTCHA detection', async ({ authenticatedPage }) => {
    // Assuming we have a test site with CAPTCHA
    await companiesPage.goto();
    await companiesPage.addCompany('CAPTCHA Test Site', 'https://www.google.com/recaptcha/api2/demo');

    await formsPage.goto();
    await formsPage.detectForm('CAPTCHA Test Site');

    // Should detect CAPTCHA
    await expect(authenticatedPage.getByText(/captcha.*detected/i)).toBeVisible();
  });

  test('should show form field mapping', async ({ authenticatedPage }) => {
    await formsPage.goto();
    await formsPage.detectForm(TEST_DATA.company.name);

    // Click on detected form to see details
    const formItem = authenticatedPage.locator('[data-testid="form-item"]').first();
    await formItem.click();

    // Should show field mapping
    await expect(authenticatedPage.getByText(/field.*mapping/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/name/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/email/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/message/i)).toBeVisible();
  });
});