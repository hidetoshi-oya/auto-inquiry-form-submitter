import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Template, 
  TemplatePreviewResponse,
  TemplateVariableDefinition,
  templatesApi 
} from '../../services/templates';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
}

export function TemplatePreviewModal({ isOpen, onClose, template }: TemplatePreviewModalProps) {
  const [preview, setPreview] = useState<TemplatePreviewResponse | null>(null);
  const [availableVariables, setAvailableVariables] = useState<TemplateVariableDefinition[]>([]);
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && template) {
      loadAvailableVariables();
      generatePreview();
    }
  }, [isOpen, template]);

  useEffect(() => {
    if (isOpen && template) {
      generatePreview();
    }
  }, [customVariables]);

  const loadAvailableVariables = async () => {
    try {
      const data = await templatesApi.getTemplateVariables();
      setAvailableVariables(data);
      
      // デフォルト値を設定
      const defaultVars: Record<string, string> = {};
      data.forEach(variable => {
        if (variable.default_value) {
          defaultVars[variable.key] = variable.default_value;
        }
      });
      setCustomVariables(defaultVars);
    } catch (err) {
      console.error('Failed to load variables:', err);
    }
  };

  const generatePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // テンプレートフィールドからコンテンツを構築
      const templateContent = template.fields
        .map(field => `${field.key}: ${field.value}`)
        .join('\n');

      const previewData = await templatesApi.previewTemplate({
        template_content: templateContent,
        variables: customVariables
      });

      setPreview(previewData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'プレビューの生成に失敗しました');
      console.error('Preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setCustomVariables(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetToDefaults = () => {
    const defaultVars: Record<string, string> = {};
    availableVariables.forEach(variable => {
      if (variable.default_value) {
        defaultVars[variable.key] = variable.default_value;
      }
    });
    setCustomVariables(defaultVars);
  };

  const exportPreview = () => {
    if (!preview || !preview.success) return;
    
    const blob = new Blob([preview.preview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_preview.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">テンプレートプレビュー</h2>
              <p className="text-gray-600 mt-1">{template.name}</p>
            </div>
            <div className="flex gap-2">
              {preview?.success && (
                <Button onClick={exportPreview} variant="outline" size="sm">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  エクスポート
                </Button>
              )}
              <Button onClick={onClose} variant="outline">
                閉じる
              </Button>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-hidden flex">
          {/* 左側: 変数設定 */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">変数設定</h3>
                <Button onClick={resetToDefaults} variant="outline" size="sm">
                  リセット
                </Button>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-red-800 text-sm">{error}</div>
                </div>
              )}

              {/* 使用されている変数 */}
              {preview?.variables_used && preview.variables_used.length > 0 && (
                <Card className="p-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">このテンプレートで使用されている変数</h4>
                  <div className="space-y-3">
                    {preview.variables_used.map((varKey) => {
                      const varDef = availableVariables.find(v => v.key === varKey);
                      return (
                        <div key={varKey}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {varDef?.name || varKey}
                          </label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={customVariables[varKey] || ''}
                            onChange={(e) => handleVariableChange(varKey, e.target.value)}
                            placeholder={varDef?.default_value || '値を入力'}
                          />
                          {varDef?.description && (
                            <p className="text-xs text-gray-500 mt-1">{varDef.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* 全ての利用可能な変数 */}
              <Card className="p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-3">利用可能な変数</h4>
                <div className="space-y-3">
                  {availableVariables.map((variable) => (
                    <div key={variable.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {variable.name}
                      </label>
                      <div className="flex gap-1 mb-1">
                        <code className="text-xs bg-gray-100 px-1 rounded">
                          {`{{${variable.key}}}`}
                        </code>
                      </div>
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={customVariables[variable.key] || ''}
                        onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                        placeholder={variable.default_value || '値を入力'}
                      />
                      {variable.description && (
                        <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* 右側: プレビュー結果 */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">プレビュー結果</h3>
            
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            ) : preview ? (
              <div className="space-y-4">
                {/* 成功/エラーステータス */}
                <div className="flex items-center gap-2 mb-4">
                  {preview.success ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">プレビュー生成成功</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm font-medium">プレビュー生成エラー</span>
                    </div>
                  )}
                </div>

                {/* プレビュー内容 */}
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    処理結果
                    {preview.success && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({preview.variables_used.length}個の変数を使用)
                      </span>
                    )}
                  </h4>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 p-3 rounded border overflow-x-auto">
                    {preview.success ? preview.preview : preview.error}
                  </pre>
                </Card>

                {/* 元のテンプレート */}
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">元のテンプレート</h4>
                  <div className="space-y-2">
                    {template.fields.map((field, index) => (
                      <div key={index} className="text-sm border-l-2 border-blue-200 pl-3">
                        <div className="font-medium text-blue-700">{field.key}:</div>
                        <div className="text-gray-700 font-mono">{field.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* テンプレート情報 */}
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">テンプレート情報</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">カテゴリ:</span>
                      <span className="ml-2 font-medium">{template.category}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">フィールド数:</span>
                      <span className="ml-2 font-medium">{template.fields.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">変数数:</span>
                      <span className="ml-2 font-medium">{template.variables.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">更新日:</span>
                      <span className="ml-2 font-medium">
                        {new Date(template.updated_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                  {template.description && (
                    <div className="mt-3">
                      <span className="text-gray-600">説明:</span>
                      <p className="mt-1 text-gray-800">{template.description}</p>
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                プレビューを読み込み中...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}