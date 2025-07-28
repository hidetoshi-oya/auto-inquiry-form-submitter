export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
export const APP_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export const TEST_TIMEOUT = {
  SHORT: 5000,
  MEDIUM: 15000,
  LONG: 30000,
};

export const TEST_DATA = {
  company: {
    name: 'Test Company Inc.',
    url: 'https://example.com',
  },
  template: {
    name: 'Test Template',
    category: 'General',
    fields: {
      company_name: '{{company_name}}',
      contact_name: 'Test User',
      email: 'test@example.com',
      message: 'This is a test inquiry message.',
    },
  },
};