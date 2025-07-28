"""
フォーム検出機能のテスト
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.services.form_detector import FormDetector


class TestFormDetector:
    """フォーム検出エンジンのテストクラス"""
    
    def test_is_valid_contact_url(self):
        """有効な問い合わせURLの判定テスト"""
        detector = FormDetector()
        base_url = "https://example.com"
        
        # 有効なURL
        valid_urls = [
            "https://example.com/contact",
            "https://example.com/inquiry",
            "https://subdomain.example.com/contact"
        ]
        
        for url in valid_urls:
            assert detector._is_valid_contact_url(url, base_url) == True
        
        # 無効なURL
        invalid_urls = [
            "https://other-domain.com/contact",
            "javascript:void(0)",
            "mailto:test@example.com",
            "https://example.com/document.pdf"
        ]
        
        for url in invalid_urls:
            assert detector._is_valid_contact_url(url, base_url) == False
    
    def test_determine_field_type(self):
        """フィールドタイプ判定のテスト"""
        detector = FormDetector()
        
        # メールフィールド
        field_type = detector._determine_field_type(
            "input", "email", "email", "email-field", "メールアドレス", "メールアドレス"
        )
        assert field_type.value == "email"
        
        # 電話番号フィールド
        field_type = detector._determine_field_type(
            "input", "tel", "phone", "phone-field", "電話番号", "電話番号"
        )
        assert field_type.value == "tel"
        
        # テキストエリア
        field_type = detector._determine_field_type(
            "textarea", "", "message", "message-field", "お問い合わせ内容", "お問い合わせ内容"
        )
        assert field_type.value == "textarea"
        
        # セレクトボックス
        field_type = detector._determine_field_type(
            "select", "", "category", "category-field", "カテゴリ", "カテゴリ"
        )
        assert field_type.value == "select"
    
    @pytest.mark.asyncio
    async def test_contact_keywords(self):
        """問い合わせキーワードの確認テスト"""
        detector = FormDetector()
        
        # 日本語キーワード
        japanese_keywords = ["お問い合わせ", "問い合わせ", "お客様相談", "サポート"]
        for keyword in japanese_keywords:
            assert keyword in detector.CONTACT_KEYWORDS
        
        # 英語キーワード
        english_keywords = ["contact", "inquiry", "support", "help"]
        for keyword in english_keywords:
            assert keyword in detector.CONTACT_KEYWORDS
    
    @pytest.mark.asyncio
    async def test_field_type_patterns(self):
        """フィールドタイプパターンの確認テスト"""
        detector = FormDetector()
        
        # Emailパターン
        email_patterns = detector.FIELD_TYPE_PATTERNS.get("email", [])
        assert len(email_patterns) > 0
        assert any("email" in pattern for pattern in email_patterns)
        
        # 電話番号パターン
        tel_patterns = detector.FIELD_TYPE_PATTERNS.get("tel", [])
        assert len(tel_patterns) > 0
        assert any("tel" in pattern for pattern in tel_patterns)


class TestFormDetectorIntegration:
    """フォーム検出の統合テスト"""
    
    @pytest.mark.asyncio
    async def test_detect_forms_with_mock_data(self):
        """モックデータを使ったフォーム検出テスト"""
        # モックDBセッション
        mock_db = Mock()
        
        # モック企業データ
        company_url = "https://example.com"
        company_id = 1
        
        # FormDetectorインスタンス
        detector = FormDetector()
        
        # ブラウザプールをモック
        with patch('app.services.form_detector.browser_pool') as mock_pool:
            # モックページ
            mock_page = AsyncMock()
            mock_page.goto = AsyncMock()
            mock_page.wait_for_timeout = AsyncMock()
            mock_page.locator.return_value.all.return_value = []  # リンクなし
            
            # ページコンテキストをモック
            mock_pool.get_page.return_value.__aenter__.return_value = mock_page
            mock_pool.get_page.return_value.__aexit__.return_value = None
            
            # フォーム検出を実行
            results = await detector.detect_forms(company_url, company_id, mock_db)
            
            # 基本的な動作確認
            assert isinstance(results, list)
            mock_page.goto.assert_called()
    
    def test_constructor(self):
        """コンストラクタのテスト"""
        detector = FormDetector()
        assert detector.current_page is None
        assert hasattr(detector, 'CONTACT_KEYWORDS')
        assert hasattr(detector, 'FIELD_TYPE_PATTERNS') 