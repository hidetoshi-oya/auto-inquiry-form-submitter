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
  // デバッグ用API
  async getDebugCount(): Promise<any> {
    console.log('🌐 デバッグAPI呼び出し開始');
    console.log('🌐 認証トークン確認:', {
      hasToken: !!localStorage.getItem('access_token'),
      tokenLength: localStorage.getItem('access_token')?.length || 0,
      tokenPrefix: localStorage.getItem('access_token')?.substring(0, 10) + '...' || 'N/A'
    });
    
    try {
      console.log('🌐 API呼び出し実行: GET /templates/debug/count');
      const data = await api.get('/templates/debug/count');
      
      console.log('🌐 デバッグAPI レスポンス成功:', {
        dataType: typeof data,
        dataContent: data,
        dataKeys: data ? Object.keys(data) : 'N/A'
      });
      
      return data;
    } catch (error) {
      console.error('🌐 デバッグAPI呼び出しエラー（詳細）:', {
        error,
        errorType: typeof error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        response: (error as any)?.response ? {
          status: (error as any).response.status,
          statusText: (error as any).response.statusText,
          data: (error as any).response.data,
          headers: (error as any).response.headers
        } : 'No response object',
        request: (error as any)?.request ? {
          method: (error as any).request.method,
          url: (error as any).request.url,
          headers: (error as any).request.headers
        } : 'No request object',
        config: (error as any)?.config ? {
          baseURL: (error as any).config.baseURL,
          url: (error as any).config.url,
          method: (error as any).config.method,
          headers: (error as any).config.headers
        } : 'No config object'
      });
      
      throw error;
    }
  },

  // 基本CRUD操作
  async getTemplates(params?: {
    skip?: number;
    limit?: number;
    category?: string;
  }): Promise<Template[]> {
    console.log('🌐 API呼び出し: GET /templates/', { params });
    try {
      const data = await api.get('/templates/', { params });
      console.log('🌐 API レスポンス成功:', {
        dataType: typeof data,
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        data: data
      });
      return data;
    } catch (error) {
      console.error('🌐 API呼び出しエラー:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        response: (error as any)?.response ? {
          status: (error as any).response.status,
          statusText: (error as any).response.statusText,
          data: (error as any).response.data
        } : undefined
      });
      throw error;
    }
  },

  async getTemplate(id: number): Promise<Template> {
    const data = await api.get(`/templates/${id}`);
    return data;
  },

  async createTemplate(template: TemplateCreate): Promise<Template> {
    const data = await api.post('/templates/', template);
    return data;
  },

  async updateTemplate(id: number, template: TemplateUpdate): Promise<Template> {
    const data = await api.put(`/templates/${id}`, template);
    return data;
  },

  async deleteTemplate(id: number): Promise<Template> {
    const data = await api.delete(`/templates/${id}`);
    return data;
  },

  // プレビュー機能
  async previewTemplate(request: TemplatePreviewRequest): Promise<TemplatePreviewResponse> {
    const data = await api.post('/templates/preview', request);
    return data;
  },

  async previewTemplateById(id: number, variables?: Record<string, string>): Promise<TemplatePreviewResponse> {
    const data = await api.get(`/templates/${id}/preview`, { params: { variables } });
    return data;
  },

  // 検証機能
  async validateTemplate(templateContent: string): Promise<TemplateValidationResponse> {
    const data = await api.post('/templates/validate', { template_content: templateContent });
    return data;
  },

  // 変数管理
  async getTemplateVariables(): Promise<TemplateVariableDefinition[]> {
    const data = await api.get('/templates/variables');
    return data?.variables || [];
  },

  // カテゴリ管理
  async getTemplateCategories(): Promise<TemplateCategoriesResponse> {
    console.log('🌐 API呼び出し: GET /templates/categories');
    try {
      const data = await api.get('/templates/categories');
      console.log('🌐 カテゴリ API レスポンス成功:', {
        data: data
      });
      return data;
    } catch (error) {
      console.error('🌐 カテゴリ API呼び出しエラー:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        response: (error as any)?.response ? {
          status: (error as any).response.status,
          statusText: (error as any).response.statusText,
          data: (error as any).response.data
        } : undefined
      });
      throw error;
    }
  },
};