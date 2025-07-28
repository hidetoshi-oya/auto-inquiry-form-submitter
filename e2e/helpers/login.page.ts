import { Page, Locator } from '@playwright/test';
import { APP_BASE_URL } from './constants';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.registerLink = page.getByRole('link', { name: 'Register' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto(`${APP_BASE_URL}/login`);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectError(message: string) {
    await this.errorMessage.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500); // Allow error to fully render
    const errorText = await this.errorMessage.textContent();
    return errorText?.includes(message);
  }
}