import { Page, Locator } from '@playwright/test';
import { APP_BASE_URL } from './constants';

export class FormsPage {
  readonly page: Page;
  readonly detectFormButton: Locator;
  readonly companySelect: Locator;
  readonly detectionProgress: Locator;
  readonly detectedFormsList: Locator;
  readonly templateSelect: Locator;
  readonly submitFormButton: Locator;
  readonly submissionStatus: Locator;

  constructor(page: Page) {
    this.page = page;
    this.detectFormButton = page.getByRole('button', { name: /detect.*form/i });
    this.companySelect = page.getByLabel('Select Company');
    this.detectionProgress = page.locator('[data-testid="detection-progress"]');
    this.detectedFormsList = page.locator('[data-testid="detected-forms-list"]');
    this.templateSelect = page.getByLabel('Select Template');
    this.submitFormButton = page.getByRole('button', { name: /submit.*form/i });
    this.submissionStatus = page.locator('[data-testid="submission-status"]');
  }

  async goto() {
    await this.page.goto(`${APP_BASE_URL}/forms`);
  }

  async detectForm(companyName: string) {
    await this.companySelect.selectOption({ label: companyName });
    await this.detectFormButton.click();
    
    // Wait for detection to complete
    await this.detectionProgress.waitFor({ state: 'visible' });
    await this.detectionProgress.waitFor({ state: 'hidden', timeout: 30000 });
  }

  async submitForm(templateName: string) {
    await this.templateSelect.selectOption({ label: templateName });
    await this.submitFormButton.click();
    
    // Wait for submission status
    await this.submissionStatus.waitFor({ state: 'visible' });
  }

  async getDetectedFormsCount() {
    const forms = this.page.locator('[data-testid="form-item"]');
    return await forms.count();
  }

  async isSubmissionSuccessful() {
    const status = await this.submissionStatus.textContent();
    return status?.toLowerCase().includes('success');
  }
}