import { Form, User, TaskStatusResponse, TaskListResponse, TaskMetrics, TaskStatus } from './models';

// 共通レスポンス型
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  detail: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// 認証関連
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

// 企業管理
export interface CreateCompanyRequest {
  name: string;
  url: string;
  memo?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  url?: string;
  status?: 'active' | 'inactive' | 'blocked';
  memo?: string;
}

export interface CompanyListParams {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'inactive' | 'blocked';
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'lastSubmittedAt';
  sortOrder?: 'asc' | 'desc';
}

// フォーム検出
export interface DetectFormRequest {
  companyId: string;
  forceRefresh?: boolean;
}

export interface DetectFormResponse {
  forms: Form[];
  detectionTime: number;
}

// テンプレート管理
export interface CreateTemplateRequest {
  name: string;
  category: string;
  fields: Array<{
    key: string;
    value: string;
  }>;
}

export interface UpdateTemplateRequest {
  name?: string;
  category?: string;
  fields?: Array<{
    key: string;
    value: string;
  }>;
}

export interface TemplateListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
}

// 送信管理
export interface SingleSubmissionRequest {
  companyId: string;
  templateId: string;
  variables?: Record<string, string>;
  confirmBeforeSubmit?: boolean;
}

export interface BatchSubmissionRequest {
  companyIds: string[];
  templateId: string;
  variables?: Record<string, string>;
  delayBetweenSubmissions?: number; // ミリ秒
}

export interface SubmissionHistoryParams {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'success' | 'failed' | 'captcha_required';
  companyId?: string;
  templateId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// スケジュール管理
export interface CreateScheduleRequest {
  name: string;
  companyIds: string[];
  templateId: string;
  cronExpression: string;
  enabled?: boolean;
}

export interface UpdateScheduleRequest {
  name?: string;
  companyIds?: string[];
  templateId?: string;
  cronExpression?: string;
  enabled?: boolean;
}

export interface ScheduleListParams {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

// タスク管理
export interface TaskListParams {
  status?: TaskStatus;
  task_name?: string;
  page?: number;
  per_page?: number;
}

export interface TaskActionRequest {
  action: 'revoke' | 'retry';
  terminate?: boolean;
  signal?: string;
}

export interface TaskActionResponse {
  task_id: string;
  action: string;
  success: boolean;
  message: string;
  timestamp: Date;
}