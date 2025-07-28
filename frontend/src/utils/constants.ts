// API関連の定数
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// 企業ステータス
export const COMPANY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
} as const;

export const COMPANY_STATUS_LABELS = {
  [COMPANY_STATUS.ACTIVE]: 'アクティブ',
  [COMPANY_STATUS.INACTIVE]: '非アクティブ',
  [COMPANY_STATUS.BLOCKED]: 'ブロック済み',
} as const;

// 送信ステータス
export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CAPTCHA_REQUIRED: 'captcha_required',
} as const;

export const SUBMISSION_STATUS_LABELS = {
  [SUBMISSION_STATUS.PENDING]: '送信中',
  [SUBMISSION_STATUS.SUCCESS]: '成功',
  [SUBMISSION_STATUS.FAILED]: '失敗',
  [SUBMISSION_STATUS.CAPTCHA_REQUIRED]: 'CAPTCHA必要',
} as const;

// フォームフィールドタイプ
export const FORM_FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  TEL: 'tel',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
} as const;

// ページネーション
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// その他の設定
export const DEBOUNCE_DELAY = 300; // ミリ秒
export const TOAST_DURATION = 3000; // ミリ秒
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB