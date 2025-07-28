// 企業情報
export interface Company {
  id: number;
  name: string;
  url: string;
  lastSubmittedAt?: Date;
  status: 'active' | 'inactive' | 'blocked';
  meta_data: Record<string, any>;
  memo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// フォーム情報
export interface Form {
  id: string;
  companyId: number;
  formUrl: string;
  fields: FormField[];
  submitButtonSelector: string;
  hasRecaptcha: boolean;
  detectedAt: Date;
}

// フォームフィールド
export interface FormField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox';
  selector: string;
  label?: string;
  required: boolean;
  options?: string[];
}

// テンプレート
export interface Template {
  id: string;
  name: string;
  category: string;
  fields: TemplateField[];
  variables: Variable[];
  createdAt: Date;
  updatedAt: Date;
}

// テンプレートフィールド
export interface TemplateField {
  key: string;
  value: string;
  type: 'static' | 'variable';
}

// 変数
export interface Variable {
  name: string;
  key: string;
  defaultValue?: string;
}

// 送信履歴
export interface Submission {
  id: string;
  companyId: number;
  templateId: string;
  status: 'pending' | 'success' | 'failed' | 'captcha_required';
  submittedData: Record<string, any>;
  response?: string;
  errorMessage?: string;
  submittedAt: Date;
  screenshotUrl?: string;
}

// スケジュール
export interface Schedule {
  id: string;
  name: string;
  companyIds: number[];
  templateId: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ユーザー
export interface User {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  isSuperuser: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// タスク状態
export type TaskStatus = 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED';

// タスク情報
export interface TaskInfo {
  task_id: string;
  task_name: string;
  status: TaskStatus;
  result?: any;
  traceback?: string;
  date_created?: Date;
  date_started?: Date;
  date_done?: Date;
  worker?: string;
  retries?: number;
  eta?: Date;
  expires?: Date;
  args?: any[];
  kwargs?: Record<string, any>;
}

// タスク状態レスポンス
export interface TaskStatusResponse {
  task_id: string;
  status: TaskStatus;
  result?: any;
  traceback?: string;
  progress?: Record<string, any>;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  runtime?: number;
  worker_name?: string;
  retries?: number;
  max_retries?: number;
}

// タスク一覧レスポンス
export interface TaskListResponse {
  tasks: TaskInfo[];
  total: number;
  page: number;
  per_page: number;
}

// タスクメトリクス
export interface TaskMetrics {
  total_tasks: number;
  pending_tasks: number;
  running_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  retry_tasks: number;
  average_runtime?: number;
  tasks_per_hour?: number;
}