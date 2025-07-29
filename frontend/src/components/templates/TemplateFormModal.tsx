import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Template, 
  TemplateCreate, 
  TemplateField, 
  TemplateVariable,
  TemplateVariableDefinition,
  templatesApi 
} from '../../services/templates';

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Template | null;
  onSave: () => void;
}

export function TemplateFormModal({ isOpen, onClose, template, onSave }: TemplateFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
  });
  const [fields, setFields] = useState<Omit<TemplateField, 'id' | 'template_id'>[]>([]);
  const [variables, setVariables] = useState<Omit<TemplateVariable, 'id' | 'template_id'>[]>([]);
  const [availableVariables, setAvailableVariables] = useState<TemplateVariableDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!template;

  useEffect(() => {
    if (isOpen) {
      loadAvailableVariables();
      if (template) {
        setFormData({
          name: template.name,
          category: template.category,
          description: template.description || '',
        });
        setFields(template.fields.map(f => ({
          key: f.key,
          value: f.value,
          field_type: f.field_type
        })));
        setVariables(template.variables.map(v => ({
          name: v.name,
          key: v.key,
          default_value: v.default_value
        })));
      } else {
        resetForm();
      }
    }
  }, [isOpen, template]);

  const resetForm = () => {
    setFormData({ name: '', category: '', description: '' });
    setFields([]);
    setVariables([]);
    setError(null);
  };

  const loadAvailableVariables = async () => {
    try {
      setLoading(true);
      const data = await templatesApi.getTemplateVariables();
      setAvailableVariables(data);
    } catch (err) {
      console.error('Failed to load variables:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = () => {
    setFields(prev => [...prev, { key: '', value: '', field_type: 'static' }]);
  };

  const handleUpdateField = (index: number, field: Partial<TemplateField>) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...field } : f));
  };

  const handleRemoveField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddVariable = () => {
    setVariables(prev => [...prev, { name: '', key: '', default_value: '' }]);
  };

  const handleUpdateVariable = (index: number, variable: Partial<TemplateVariable>) => {
    setVariables(prev => prev.map((v, i) => i === index ? { ...v, ...variable } : v));
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
  };

  const handleInsertVariable = (fieldIndex: number, variableKey: string) => {
    const currentField = fields[fieldIndex];
    const newValue = `${currentField.value}{{${variableKey}}}`;
    handleUpdateField(fieldIndex, { value: newValue });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('テンプレート名は必須です');
      return false;
    }
    if (!formData.category.trim()) {
      setError('カテゴリは必須です');
      return false;
    }
    if (fields.length === 0) {
      setError('少なくとも1つのフィールドが必要です');
      return false;
    }
    for (const field of fields) {
      if (!field.key.trim() || !field.value.trim()) {
        setError('全てのフィールドのキーと値を入力してください');
        return false;
      }
    }
    for (const variable of variables) {
      if (!variable.name.trim() || !variable.key.trim()) {
        setError('全ての変数の名前とキーを入力してください');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const templateData: TemplateCreate = {
        ...formData,
        fields,
        variables,
      };

      if (isEditing && template) {
        await templatesApi.updateTemplate(template.id, templateData);
      } else {
        await templatesApi.createTemplate(templateData);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'テンプレートの保存に失敗しました');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'テンプレート編集' : '新規テンプレート作成'}
          </h2>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* エラー表示 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-red-800">{error}</div>
                </div>
              )}

              {/* 基本情報 */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">基本情報</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      テンプレート名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="営業問い合わせテンプレート"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      カテゴリ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="営業, サポート, 商談 など"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      説明
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="このテンプレートの使用目的や内容について説明してください"
                    />
                  </div>
                </div>
              </Card>

              {/* フィールド管理 */}
              <Card className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">フィールド管理</h3>
                  <Button onClick={handleAddField} size="sm">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    フィールド追加
                  </Button>
                </div>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-3">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium text-gray-700">フィールド {index + 1}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveField(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">キー</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={field.key}
                            onChange={(e) => handleUpdateField(index, { key: e.target.value })}
                            placeholder="name, email, message など"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">タイプ</label>
                          <select
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={field.field_type}
                            onChange={(e) => handleUpdateField(index, { field_type: e.target.value as 'static' | 'variable' })}
                          >
                            <option value="static">固定値</option>
                            <option value="variable">変数</option>
                          </select>
                        </div>
                        <div className="md:col-span-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs text-gray-600">値</label>
                            <div className="flex gap-1">
                              {availableVariables.slice(0, 3).map((av) => (
                                <button
                                  key={av.key}
                                  type="button"
                                  className="text-xs px-1 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  onClick={() => handleInsertVariable(index, av.key)}
                                  title={`${av.name}を挿入`}
                                >
                                  {av.key}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            rows={2}
                            value={field.value}
                            onChange={(e) => handleUpdateField(index, { value: e.target.value })}
                            placeholder="こんにちは、{{company_name}}様"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 変数管理 */}
              <Card className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">カスタム変数</h3>
                  <Button onClick={handleAddVariable} size="sm" variant="outline">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    変数追加
                  </Button>
                </div>
                <div className="space-y-3">
                  {variables.map((variable, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-3">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium text-gray-700">変数 {index + 1}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveVariable(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">表示名</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={variable.name}
                            onChange={(e) => handleUpdateVariable(index, { name: e.target.value })}
                            placeholder="商品名"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">キー</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={variable.key}
                            onChange={(e) => handleUpdateVariable(index, { key: e.target.value })}
                            placeholder="product_name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">デフォルト値</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={variable.default_value}
                            onChange={(e) => handleUpdateVariable(index, { default_value: e.target.value })}
                            placeholder="弊社サービス"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 利用可能な変数一覧 */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">利用可能な変数</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {availableVariables.map((av) => (
                    <div key={av.key} className="text-xs p-2 bg-gray-50 rounded">
                      <div className="font-mono text-blue-600">{`{${av.key}}`}</div>
                      <div className="text-gray-600">{av.name}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                保存中...
              </>
            ) : (
              isEditing ? '更新' : '作成'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}