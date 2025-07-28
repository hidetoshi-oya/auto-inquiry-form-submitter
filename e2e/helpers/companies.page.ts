import { Page, Locator } from '@playwright/test';
import { APP_BASE_URL } from './constants';

export class CompaniesPage {
  readonly page: Page;
  readonly addCompanyButton: Locator;
  readonly searchInput: Locator;
  readonly companyCards: Locator;
  readonly companyNameInput: Locator;
  readonly companyUrlInput: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addCompanyButton = page.getByRole('button', { name: /add.*company/i });
    this.searchInput = page.getByPlaceholder(/search companies/i);
    this.companyCards = page.locator('[data-testid="company-card"]');
    this.companyNameInput = page.getByLabel('Company Name');
    this.companyUrlInput = page.getByLabel('Website URL');
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    this.confirmDeleteButton = page.getByRole('button', { name: /confirm.*delete/i });
  }

  async goto() {
    await this.page.goto(`${APP_BASE_URL}/companies`);
  }

  async addCompany(name: string, url: string) {
    await this.addCompanyButton.click();
    await this.companyNameInput.fill(name);
    await this.companyUrlInput.fill(url);
    await this.saveButton.click();
  }

  async searchCompany(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async deleteCompany(companyName: string) {
    const card = this.page.locator('[data-testid="company-card"]', { hasText: companyName });
    await card.click();
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
  }

  async getCompanyCount() {
    await this.page.waitForTimeout(500); // Allow cards to render
    return await this.companyCards.count();
  }

  async isCompanyVisible(name: string) {
    const card = this.page.locator('[data-testid="company-card"]', { hasText: name });
    return await card.isVisible();
  }
}