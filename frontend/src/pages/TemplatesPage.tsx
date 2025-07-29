import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { TemplateFormModal } from '../components/templates/TemplateFormModal';
import { TemplatePreviewModal } from '../components/templates/TemplatePreviewModal';
import { templatesApi, Template, TemplateCategoriesResponse } from '../services/templates';

interface FilterState {
  category: string;
  search: string;
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategoriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    search: ''
  });

  const ITEMS_PER_PAGE = 10;

  // 初期化時のデバッグログ
  console.log('🚀 TemplatesPage初期化', {
    hasAccessToken: !!localStorage.getItem('access_token'),
    hasUser: !!localStorage.getItem('user'),
    tokenLength: localStorage.getItem('access_token')?.length || 0,
    apiBaseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
    initialState: {
      templatesCount: templates.length,
      loading,
      error,
      currentPage,
      filters
    },
    timestamp: new Date().toISOString()
  });

  const loadTemplates = useCallback(async () => {
    let ignore = false; // レースコンディション対策
    
    try {
      setLoading(true);
      console.log('🔄 テンプレート取得開始', {
        currentPage,
        itemsPerPage: ITEMS_PER_PAGE,
        skip: (currentPage - 1) * ITEMS_PER_PAGE,
        categoryFilter: filters.category,
        searchFilter: filters.search,
        timestamp: new Date().toISOString()
      });
      
      const data = await templatesApi.getTemplates({
        skip: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        category: filters.category || undefined
      });
      
      // レースコンディションチェック
      if (ignore) {
        console.log('🚫 テンプレート取得結果を無視（レースコンディション対策）');
        return;
      }
      
      console.log('📥 API レスポンス受信', {
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        data: data,
        timestamp: new Date().toISOString()
      });
      
      // データが配列であることを確認
      const safeData = Array.isArray(data) ? data : [];
      
      // データ構造の詳細チェック（デバッグ用）
      if (safeData.length > 0) {
        const sampleTemplate = safeData[0];
        console.log('🔍 テンプレートデータ構造チェック:', {
          id: sampleTemplate.id,
          name: sampleTemplate.name,
          fieldsType: typeof sampleTemplate.fields,
          fieldsIsArray: Array.isArray(sampleTemplate.fields),
          fieldsLength: Array.isArray(sampleTemplate.fields) ? sampleTemplate.fields.length : 'N/A',
          variablesType: typeof sampleTemplate.variables,
          variablesIsArray: Array.isArray(sampleTemplate.variables),
          variablesLength: Array.isArray(sampleTemplate.variables) ? sampleTemplate.variables.length : 'N/A',
          sampleData: {
            fields: sampleTemplate.fields,
            variables: sampleTemplate.variables
          }
        });
      }
      
      // fieldsとvariablesの配列が存在することを確認し、存在しない場合は空配列で初期化
      const normalizedData = safeData.map(template => ({
        ...template,
        fields: Array.isArray(template.fields) ? template.fields : [],
        variables: Array.isArray(template.variables) ? template.variables : []
      }));
      
      // フィルタリング処理（検索）
      const filteredData = filters.search 
        ? normalizedData.filter(template => 
            template.name.toLowerCase().includes(filters.search.toLowerCase()) ||
            template.description?.toLowerCase().includes(filters.search.toLowerCase())
          )
        : normalizedData;
      
      console.log('✅ データ処理完了', {
        originalCount: safeData.length,
        normalizedCount: normalizedData.length,
        filteredCount: filteredData.length,
        searchFilter: filters.search,
        timestamp: new Date().toISOString()
      });
      
      if (!ignore) { // 再度レースコンディションチェック
        setTemplates(filteredData);
        setError(null);
      }
    } catch (err) {
      if (ignore) {
        console.log('🚫 エラー処理を無視（レースコンディション対策）');
        return;
      }
      
      console.error('❌ テンプレート取得エラー:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      // 詳細なエラーメッセージを生成
      let errorMessage = 'テンプレートの取得に失敗しました';
      
      if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as any).status;
        switch (status) {
          case 401:
            errorMessage = '認証エラー：ログインし直してください';
            break;
          case 403:
            errorMessage = '権限エラー：テンプレートにアクセスする権限がありません';
            break;
          case 404:
            errorMessage = 'APIエンドポイントが見つかりません';
            break;
          case 500:
            errorMessage = 'サーバーエラーが発生しました';
            break;
          default:
            errorMessage = `テンプレートの取得に失敗しました (HTTP ${status})`;
        }
      } else if (err instanceof Error) {
        if (err.message.includes('Network Error') || err.message.includes('fetch')) {
          errorMessage = 'ネットワークエラー：サーバーに接続できません';
        } else {
          errorMessage = `エラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setTemplates([]); // エラー時は空配列を設定
    } finally {
      if (!ignore) {
        setLoading(false);
      }
    }
    
    // クリーンアップ関数を返す
    return () => {
      console.log('🧹 loadTemplates クリーンアップ実行');
      ignore = true;
    };
  }, [currentPage, filters.category, filters.search]);

  const loadCategories = useCallback(async () => {
    try {
      console.log('🔄 カテゴリ取得開始');
      const data = await templatesApi.getTemplateCategories();
      console.log('📥 カテゴリ API レスポンス受信', {
        dataType: typeof data,
        data: data
      });
      setCategories(data);
      console.log('✅ カテゴリ設定完了');
    } catch (err) {
      console.error('❌ カテゴリ取得エラー:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }, []);

  useEffect(() => {
    let cleanupTemplates: (() => void) | undefined;
    let cleanupCategories: (() => void) | undefined;
    
    console.log('🔄 useEffect実行 - loadTemplates & loadCategories', {
      currentPage,
      'filters.category': filters.category,
      'filters.search': filters.search,
      timestamp: new Date().toISOString()
    });
    
    // テンプレートロード（クリーンアップ関数を取得）
    const executeLoadTemplates = async () => {
      cleanupTemplates = await loadTemplates();
    };
    
    executeLoadTemplates();
    loadCategories();
    
    // クリーンアップ関数
    return () => {
      console.log('🧹 useEffect クリーンアップ実行');
      if (cleanupTemplates) {
        cleanupTemplates();
      }
      if (cleanupCategories) {
        cleanupCategories();
      }
    };
  }, [currentPage, filters.category, filters.search, loadTemplates, loadCategories]); // 関数も依存配列に含める

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('このテンプレートを削除してもよろしいですか？')) {
      return;
    }

    try {
      await templatesApi.deleteTemplate(id);
      loadTemplates();
    } catch (err) {
      alert('削除に失敗しました');
      console.error('Delete error:', err);
    }
  };

  const handlePreviewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDebugCount = async () => {
    try {
      console.log('🐛 デバッグカウント開始');
      
      // 基本的な環境情報を確認
      const token = localStorage.getItem('access_token');
      const user = localStorage.getItem('user');
      
      console.log('🔧 環境情報:', {
        baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
        mode: import.meta.env.MODE,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        hasUser: !!user,
        userInfo: user ? JSON.parse(user) : null,
        currentURL: window.location.href
      });
      
      // 認証チェック
      if (!token) {
        throw new Error('認証トークンが見つかりません。ログインが必要です。');
      }
      
      // AXIOS完全バイパステスト - fetch APIで直接呼び出し
      console.log('🧪 Fetch API直接テスト開始');
      try {
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const fetchUrl = `${baseURL}/templates/debug/count`;
        console.log('🧪 Fetch URL:', fetchUrl);
        
        const fetchResponse = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('🧪 Fetch Response:', {
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          ok: fetchResponse.ok
        });
        
        const fetchData = await fetchResponse.json();
        console.log('🧪 Fetch Data:', fetchData);
        
        if (fetchData && typeof fetchData === 'object') {
          alert(`✅ Fetch API成功！
総テンプレート数: ${fetchData.total_templates}
総フィールド数: ${fetchData.total_fields}
総変数数: ${fetchData.total_variables}

Axios APIでテストを続行します...`);
        }
      } catch (fetchError) {
        console.error('🧪 Fetch API エラー:', fetchError);
        alert(`❌ Fetch API失敗: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`);
        return;
      }
      
      console.log('🔄 Axios API テスト開始');
      const debugData = await templatesApi.getDebugCount();
      console.log('🐛 デバッグカウント結果（詳細）:', {
        data: debugData,
        type: typeof debugData,
        isObject: debugData && typeof debugData === 'object',
        keys: debugData ? Object.keys(debugData) : 'N/A',
        hasExpectedFields: {
          total_templates: 'total_templates' in (debugData || {}),
          total_fields: 'total_fields' in (debugData || {}),
          total_variables: 'total_variables' in (debugData || {}),
          sample_templates: 'sample_templates' in (debugData || {})
        }
      });
      
      // データの存在チェック
      if (!debugData || typeof debugData !== 'object') {
        throw new Error(`Invalid response data: ${JSON.stringify(debugData)}`);
      }
      
      // 安全にプロパティを取得
      const totalTemplates = debugData.total_templates ?? 'N/A';
      const totalFields = debugData.total_fields ?? 'N/A';
      const totalVariables = debugData.total_variables ?? 'N/A';
      const sampleCount = Array.isArray(debugData.sample_templates) ? debugData.sample_templates.length : 'N/A';
      
      alert(`デバッグ結果：
総テンプレート数: ${totalTemplates}
総フィールド数: ${totalFields}
総変数数: ${totalVariables}
サンプルテンプレート数: ${sampleCount}

詳細はコンソールログとネットワークタブをご確認ください。`);
    } catch (err) {
      console.error('🐛 デバッグカウントエラー（詳細）:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        response: (err as any)?.response ? {
          status: (err as any).response.status,
          statusText: (err as any).response.statusText,
          data: (err as any).response.data,
          headers: (err as any).response.headers
        } : undefined
      });
      
      // 特定のエラーケースに対する対処法を提示
      let errorMessage = err instanceof Error ? err.message : 'Unknown error';
      let solution = '';
      
      if (errorMessage.includes('認証トークンが見つかりません')) {
        solution = '\n\n💡 対処法: /login ページでログインしてください。';
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        solution = '\n\n💡 対処法: バックエンドサーバーが起動しているか確認してください。\nターミナルで: cd backend && uvicorn app.main:app --reload';
      } else if ((err as any)?.response?.status === 401) {
        solution = '\n\n💡 対処法: 認証が無効です。再ログインしてください。';
      } else if ((err as any)?.response?.status === 404) {
        solution = '\n\n💡 対処法: APIエンドポイントが見つかりません。バックエンドの設定を確認してください。';
      }
      
      alert(`デバッグ実行中にエラーが発生しました：
${errorMessage}${solution}

詳細はコンソールログとネットワークタブをご確認ください。`);
    }
  };

  const totalPages = Math.ceil((categories?.total_templates || 0) / ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={loadTemplates} variant="outline">
          再試行
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">テンプレート管理</h1>
          <p className="text-gray-600 mt-1">問い合わせ内容のテンプレートを作成・管理します</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDebugCount}
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            🐛 デバッグ
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            新規テンプレート
          </Button>
        </div>
      </div>

      {/* フィルター */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="テンプレート名で検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <div className="sm:w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">全てのカテゴリ</option>
              {categories?.categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* カテゴリ統計 */}
      {categories && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{categories.total_templates}</div>
            <div className="text-sm text-gray-600">総テンプレート数</div>
          </Card>
          {categories.categories.slice(0, 3).map((cat) => (
            <Card key={cat.category} className="p-4">
              <div className="text-2xl font-bold text-gray-900">{cat.count}</div>
              <div className="text-sm text-gray-600">{cat.category}</div>
            </Card>
          ))}
        </div>
      )}

      {/* テンプレート一覧 */}
      {templates.length === 0 ? (
        <EmptyState
          title="テンプレートが見つかりません"
          description="新規テンプレートを作成するか、検索条件を変更してください。"
          action={
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              新規テンプレート作成
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {template.category}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-gray-600 mb-3">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>フィールド数: {Array.isArray(template.fields) ? template.fields.length : 0}</span>
                    <span>変数数: {Array.isArray(template.variables) ? template.variables.length : 0}</span>
                    <span>更新日: {formatDate(template.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewTemplate(template)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    プレビュー
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowCreateModal(true);
                    }}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    編集
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    削除
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* テンプレート作成・編集モーダル */}
      <TemplateFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        onSave={() => {
          loadTemplates();
          loadCategories();
        }}
      />

      {/* テンプレートプレビューモーダル */}
      {showPreviewModal && selectedTemplate && (
        <TemplatePreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
        />
      )}
    </div>
  );
} 