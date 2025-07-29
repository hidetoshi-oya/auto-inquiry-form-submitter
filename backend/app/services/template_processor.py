import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from jinja2 import Template, Environment, meta
from pydantic import BaseModel


class TemplateVariable(BaseModel):
    """テンプレート変数の定義"""
    name: str  # 表示用名前
    key: str   # 変数キー（{{key}}の形式で使用）
    default_value: Optional[str] = None
    description: Optional[str] = None


class TemplateProcessor:
    """テンプレート処理エンジン"""
    
    def __init__(self):
        self.env = Environment()
        # デフォルト変数の定義
        self.default_variables = {
            'company_name': '企業名',
            'date': datetime.now().strftime('%Y年%m月%d日'),
            'current_year': str(datetime.now().year),
            'current_month': str(datetime.now().month),
            'current_day': str(datetime.now().day),
            'user_name': 'ユーザー名',
            'contact_person': '担当者名',
            'department': '部署名',
            'phone': '電話番号',
            'email': 'メールアドレス',
            'website': 'ウェブサイト',
            'service_name': 'サービス名',
        }
    
    def extract_variables(self, template_content: str) -> List[str]:
        """テンプレートコンテンツから変数を抽出"""
        try:
            template = self.env.parse(template_content)
            variables = meta.find_undeclared_variables(template)
            return list(variables)
        except Exception:
            # Jinja2パースエラーの場合、正規表現でフォールバック
            pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
            variables = re.findall(pattern, template_content)
            return list(set(variables))
    
    def validate_template(self, template_content: str) -> Dict[str, Any]:
        """テンプレートの妥当性をチェック"""
        try:
            template = Template(template_content)
            variables = self.extract_variables(template_content)
            return {
                'valid': True,
                'variables': variables,
                'error': None
            }
        except Exception as e:
            return {
                'valid': False,
                'variables': [],
                'error': str(e)
            }
    
    def process_template(
        self, 
        template_content: str, 
        variables: Dict[str, str] = None
    ) -> str:
        """テンプレートを処理して変数を置換"""
        if variables is None:
            variables = {}
        
        # デフォルト変数とマージ（ユーザー指定が優先）
        merged_vars = {**self.default_variables, **variables}
        
        try:
            template = Template(template_content)
            return template.render(**merged_vars)
        except Exception as e:
            # エラーの場合は元のテンプレートを返す
            return template_content
    
    def get_preview(
        self, 
        template_content: str, 
        custom_variables: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """テンプレートのプレビューを生成"""
        validation = self.validate_template(template_content)
        
        if not validation['valid']:
            return {
                'success': False,
                'error': validation['error'],
                'preview': template_content,
                'variables_used': []
            }
        
        # カスタム変数がない場合はサンプルデータを使用
        if custom_variables is None:
            custom_variables = self._get_sample_variables()
        
        processed_content = self.process_template(template_content, custom_variables)
        
        return {
            'success': True,
            'preview': processed_content,
            'variables_used': validation['variables'],
            'available_variables': list(self.default_variables.keys())
        }
    
    def _get_sample_variables(self) -> Dict[str, str]:
        """サンプル変数データを取得"""
        return {
            'company_name': '株式会社サンプル',
            'date': datetime.now().strftime('%Y年%m月%d日'),
            'current_year': str(datetime.now().year),
            'current_month': str(datetime.now().month),
            'current_day': str(datetime.now().day),
            'user_name': '山田太郎',
            'contact_person': '佐藤花子',
            'department': '営業部',
            'phone': '03-1234-5678',
            'email': 'sample@example.com',
            'website': 'https://example.com',
            'service_name': 'お問い合わせ自動化サービス',
        }
    
    def get_variable_definitions(self) -> List[TemplateVariable]:
        """利用可能な変数の定義を取得"""
        definitions = [
            TemplateVariable(
                name="企業名",
                key="company_name",
                description="問い合わせ先の企業名"
            ),
            TemplateVariable(
                name="現在の日付",
                key="date",
                default_value=datetime.now().strftime('%Y年%m月%d日'),
                description="現在の日付（YYYY年MM月DD日形式）"
            ),
            TemplateVariable(
                name="現在の年",
                key="current_year",
                default_value=str(datetime.now().year),
                description="現在の年"
            ),
            TemplateVariable(
                name="現在の月",
                key="current_month",
                default_value=str(datetime.now().month),
                description="現在の月"
            ),
            TemplateVariable(
                name="現在の日",
                key="current_day",
                default_value=str(datetime.now().day),
                description="現在の日"
            ),
            TemplateVariable(
                name="ユーザー名",
                key="user_name",
                description="送信者のユーザー名"
            ),
            TemplateVariable(
                name="担当者名",
                key="contact_person",
                description="問い合わせ担当者名"
            ),
            TemplateVariable(
                name="部署名",
                key="department",
                description="送信者の部署名"
            ),
            TemplateVariable(
                name="電話番号",
                key="phone",
                description="送信者の電話番号"
            ),
            TemplateVariable(
                name="メールアドレス",
                key="email",
                description="送信者のメールアドレス"
            ),
            TemplateVariable(
                name="ウェブサイト",
                key="website",
                description="送信者のウェブサイトURL"
            ),
            TemplateVariable(
                name="サービス名",
                key="service_name",
                description="提供サービス名"
            ),
        ]
        return definitions


# グローバルインスタンス
template_processor = TemplateProcessor()