import { api } from './api';

export interface TemplateField {
  id?: number;
  template_id?: number;
  key: string;
  value: string;
  field_type: 'static' | 'variable';
}

export interface TemplateVariable {
  id?: number;
  template_id?: number;
  name: string;
  key: string;
  default_value?: string;
}

export interface Template {
  id: number;
  name: string;
  category: string;
  description?: string;
  fields: TemplateField[];
  variables: TemplateVariable[];
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  category: string;
  description?: string;
  fields: Omit<TemplateField, 'id' | 'template_id'>[];
  variables: Omit<TemplateVariable, 'id' | 'template_id'>[];
}

export interface TemplateUpdate {
  name?: string;
  category?: string;
  description?: string;
  fields?: Omit<TemplateField, 'id' | 'template_id'>[];
  variables?: Omit<TemplateVariable, 'id' | 'template_id'>[];
}

export interface TemplatePreviewRequest {
  template_content: string;
  variables?: Record<string, string>;
}

export interface TemplatePreviewResponse {
  success: boolean;
  preview: string;
  variables_used: string[];
  available_variables: string[];
  error?: string;
}

export interface TemplateValidationResponse {
  valid: boolean;
  variables: string[];
  error?: string;
}

export interface TemplateVariableDefinition {
  name: string;
  key: string;
  default_value?: string;
  description?: string;
}

export interface TemplateCategoryStats {
  category: string;
  count: number;
  last_updated?: string;
}

export interface TemplateCategoriesResponse {
  categories: TemplateCategoryStats[];
  total_templates: number;
}

export const templatesApi = {
  // 基本CRUD操作
  async getTemplates(params?: {
    skip?: number;
    limit?: number;
    category?: string;
  }): Promise<Template[]> {
    const { data } = await api.get('/templates/', { params });
    return data;
  },

  async getTemplate(id: number): Promise<Template> {
    const { data } = await api.get(`/templates/${id}`);
    return data;
  },

  async createTemplate(template: TemplateCreate): Promise<Template> {
    const { data } = await api.post('/templates/', template);
    return data;
  },

  async updateTemplate(id: number, template: TemplateUpdate): Promise<Template> {
    const { data } = await api.put(`/templates/${id}`, template);
    return data;
  },

  async deleteTemplate(id: number): Promise<Template> {
    const { data } = await api.delete(`/templates/${id}`);
    return data;
  },

  // プレビュー機能
  async previewTemplate(request: TemplatePreviewRequest): Promise<TemplatePreviewResponse> {
    const { data } = await api.post('/templates/preview', request);
    return data;
  },

  async previewTemplateById(id: number, variables?: Record<string, string>): Promise<TemplatePreviewResponse> {
    const { data } = await api.get(`/templates/${id}/preview`, { params: { variables } });
    return data;
  },

  // 検証機能
  async validateTemplate(templateContent: string): Promise<TemplateValidationResponse> {
    const { data } = await api.post('/templates/validate', { template_content: templateContent });
    return data;
  },

  // 変数管理
  async getTemplateVariables(): Promise<TemplateVariableDefinition[]> {
    const { data } = await api.get('/templates/variables');
    return data?.variables || [];
  },

  // カテゴリ管理
  async getTemplateCategories(): Promise<TemplateCategoriesResponse> {
    const { data } = await api.get('/templates/categories');
    return data;
  },
};