import pytest
import time
from unittest.mock import patch, MagicMock
from app.core.security import (
    SecurityConfig,
    CSRFProtection,
    RateLimiter,
    InputSanitizer,
    DataEncryption,
    csrf_protection,
    rate_limiter
)


class TestCSRFProtection:
    """CSRF保護機能のテスト"""
    
    def test_generate_token(self):
        """CSRFトークン生成のテスト"""
        csrf = CSRFProtection()
        user_id = "test_user_123"
        
        token = csrf.generate_token(user_id)
        
        assert token is not None
        assert len(token) > 20  # URLセーフなトークンの長さチェック
        assert token in csrf.tokens
        assert csrf.tokens[token]['user_id'] == user_id
    
    def test_validate_token_success(self):
        """有効なCSRFトークンの検証テスト"""
        csrf = CSRFProtection()
        user_id = "test_user_123"
        
        token = csrf.generate_token(user_id)
        is_valid = csrf.validate_token(token, user_id)
        
        assert is_valid is True
        assert token not in csrf.tokens  # ワンタイムトークンなので削除される
    
    def test_validate_token_invalid_user(self):
        """無効なユーザーIDでのCSRFトークン検証テスト"""
        csrf = CSRFProtection()
        user_id = "test_user_123"
        wrong_user_id = "wrong_user_456"
        
        token = csrf.generate_token(user_id)
        is_valid = csrf.validate_token(token, wrong_user_id)
        
        assert is_valid is False
        assert token in csrf.tokens  # 失敗時はトークンが残る
    
    def test_validate_token_nonexistent(self):
        """存在しないCSRFトークンの検証テスト"""
        csrf = CSRFProtection()
        
        is_valid = csrf.validate_token("nonexistent_token", "any_user")
        
        assert is_valid is False
    
    def test_token_expiry(self):
        """CSRFトークンの有効期限テスト"""
        csrf = CSRFProtection()
        user_id = "test_user_123"
        
        # 期限切れトークンを手動で作成
        token = csrf.generate_token(user_id)
        
        # トークンの有効期限を過去に設定
        from datetime import datetime, timedelta
        past_time = datetime.utcnow() - timedelta(seconds=SecurityConfig.CSRF_TOKEN_EXPIRY + 1)
        csrf.tokens[token]['expires_at'] = past_time
        
        # 期限切れトークンの検証
        is_valid = csrf.validate_token(token, user_id)
        
        assert is_valid is False
    
    def test_cleanup_expired_tokens(self):
        """期限切れトークンのクリーンアップテスト"""
        csrf = CSRFProtection()
        
        # 有効なトークンと期限切れトークンを作成
        valid_token = csrf.generate_token("user1")
        
        # 期限切れトークンを手動で追加
        from datetime import datetime, timedelta
        expired_time = datetime.utcnow() - timedelta(seconds=SecurityConfig.CSRF_TOKEN_EXPIRY + 1)
        csrf.tokens["expired_token"] = {
            'user_id': "user2",
            'expires_at': expired_time,
            'created_at': expired_time
        }
        
        # クリーンアップを実行
        csrf._cleanup_expired_tokens()
        
        # 有効なトークンは残り、期限切れトークンは削除される
        assert valid_token in csrf.tokens
        assert "expired_token" not in csrf.tokens


class TestRateLimiter:
    """レート制限機能のテスト"""
    
    def test_rate_limiter_allow_initial_requests(self):
        """初回リクエストの許可テスト"""
        limiter = RateLimiter()
        identifier = "test_user_ip"
        
        is_allowed = limiter.is_allowed(identifier, max_requests=5, window=60)
        
        assert is_allowed is True
    
    def test_rate_limiter_exceed_limit(self):
        """レート制限超過テスト"""
        limiter = RateLimiter()
        identifier = "test_user_ip"
        max_requests = 3
        
        # 制限回数まで許可される
        for i in range(max_requests):
            assert limiter.is_allowed(identifier, max_requests, 60) is True
        
        # 制限超過で拒否される
        assert limiter.is_allowed(identifier, max_requests, 60) is False
    
    def test_rate_limiter_window_reset(self):
        """時間窓リセットテスト"""
        limiter = RateLimiter()
        identifier = "test_user_ip"
        max_requests = 2
        window = 1  # 1秒の窓
        
        # 制限まで使い切る
        assert limiter.is_allowed(identifier, max_requests, window) is True
        assert limiter.is_allowed(identifier, max_requests, window) is True
        assert limiter.is_allowed(identifier, max_requests, window) is False
        
        # 時間経過後にリセット
        time.sleep(1.1)
        assert limiter.is_allowed(identifier, max_requests, window) is True
    
    def test_get_remaining_requests(self):
        """残りリクエスト数取得テスト"""
        limiter = RateLimiter()
        identifier = "test_user_ip"
        max_requests = 5
        
        # 初期状態
        remaining = limiter.get_remaining_requests(identifier, max_requests)
        assert remaining == max_requests
        
        # 1回リクエスト後
        limiter.is_allowed(identifier, max_requests, 60)
        remaining = limiter.get_remaining_requests(identifier, max_requests)
        assert remaining == max_requests - 1


class TestInputSanitizer:
    """入力サニタイザーのテスト"""
    
    def test_sanitize_html_basic(self):
        """基本的なHTMLエスケープテスト"""
        dangerous_input = "<script>alert('xss')</script>"
        sanitized = InputSanitizer.sanitize_html(dangerous_input)
        
        assert "&lt;script&gt;" in sanitized
        assert "<script>" not in sanitized
        assert "alert(&#39;xss&#39;)" in sanitized
    
    def test_sanitize_html_comprehensive(self):
        """包括的HTMLエスケープテスト"""
        test_cases = [
            ("&", "&amp;"),
            ("<", "&lt;"),
            (">", "&gt;"),
            ('"', "&quot;"),
            ("'", "&#39;"),
            ("/", "&#x2F;"),
            ("`", "&#x60;"),
            ("=", "&#x3D;")
        ]
        
        for input_char, expected in test_cases:
            result = InputSanitizer.sanitize_html(input_char)
            assert result == expected
    
    def test_validate_url_valid(self):
        """有効なURL検証テスト"""
        valid_urls = [
            "https://example.com",
            "http://test.org",
            "https://subdomain.example.com/path?param=value"
        ]
        
        for url in valid_urls:
            assert InputSanitizer.validate_url(url) is True
    
    def test_validate_url_invalid_protocol(self):
        """無効なプロトコルのURL検証テスト"""
        invalid_urls = [
            "ftp://example.com",
            "javascript:alert('xss')",
            "data:text/html,<script>alert('xss')</script>",
            "file:///etc/passwd"
        ]
        
        for url in invalid_urls:
            assert InputSanitizer.validate_url(url) is False
    
    def test_validate_url_dangerous_ip(self):
        """危険なIPアドレスの検証テスト"""
        dangerous_urls = [
            "http://localhost:8080",
            "https://127.0.0.1",
            "http://192.168.1.1",
            "http://10.0.0.1",
            "http://172.16.0.1"
        ]
        
        for url in dangerous_urls:
            assert InputSanitizer.validate_url(url) is False
    
    def test_validate_email_valid(self):
        """有効なメールアドレス検証テスト"""
        valid_emails = [
            "test@example.com",
            "user.name@domain.co.jp",
            "user+tag@example.org"
        ]
        
        for email in valid_emails:
            assert InputSanitizer.validate_email(email) is True
    
    def test_validate_email_invalid(self):
        """無効なメールアドレス検証テスト"""
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "user@",
            "user@.com",
            "user space@example.com"
        ]
        
        for email in invalid_emails:
            assert InputSanitizer.validate_email(email) is False


class TestDataEncryption:
    """データ暗号化のテスト"""
    
    def test_encrypt_decrypt_cycle(self):
        """暗号化・復号化サイクルテスト"""
        encryption = DataEncryption("test_secret_key_12345")
        
        original_data = "sensitive_information_123"
        encrypted = encryption.encrypt_sensitive_data(original_data)
        
        assert encrypted != original_data
        assert len(encrypted) > 0
        
        # 検証テスト
        is_valid = encryption.verify_sensitive_data(original_data, encrypted)
        assert is_valid is True
    
    def test_verify_wrong_data(self):
        """間違ったデータの検証テスト"""
        encryption = DataEncryption("test_secret_key_12345")
        
        original_data = "correct_data"
        wrong_data = "wrong_data"
        encrypted = encryption.encrypt_sensitive_data(original_data)
        
        is_valid = encryption.verify_sensitive_data(wrong_data, encrypted)
        assert is_valid is False
    
    def test_empty_data_handling(self):
        """空データの処理テスト"""
        encryption = DataEncryption("test_secret_key_12345")
        
        encrypted = encryption.encrypt_sensitive_data("")
        assert encrypted == ""
        
        is_valid = encryption.verify_sensitive_data("", "")
        assert is_valid is False


class TestSecurityIntegration:
    """セキュリティ統合テスト"""
    
    def test_global_instances(self):
        """グローバルインスタンスの存在確認"""
        assert csrf_protection is not None
        assert rate_limiter is not None
        assert isinstance(csrf_protection, CSRFProtection)
        assert isinstance(rate_limiter, RateLimiter)
    
    def test_security_config_values(self):
        """セキュリティ設定値の確認"""
        assert SecurityConfig.CSRF_TOKEN_LENGTH == 32
        assert SecurityConfig.CSRF_TOKEN_EXPIRY == 3600
        assert SecurityConfig.RATE_LIMIT_REQUESTS == 100
        assert SecurityConfig.RATE_LIMIT_WINDOW == 3600
        
        # セキュリティヘッダーの確認
        headers = SecurityConfig.SECURITY_HEADERS
        assert "X-Content-Type-Options" in headers
        assert "X-Frame-Options" in headers
        assert "Content-Security-Policy" in headers
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert headers["X-Frame-Options"] == "DENY"
    
    def test_csp_policy_comprehensive(self):
        """CSPポリシーの包括的確認"""
        csp = SecurityConfig.CSP_POLICY
        
        # 必要なディレクティブが含まれているか確認
        assert "default-src 'self'" in csp
        assert "script-src 'self'" in csp
        assert "object-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "base-uri 'self'" in csp
    
    @pytest.mark.asyncio
    async def test_concurrent_rate_limiting(self):
        """並行レート制限テスト"""
        import asyncio
        
        limiter = RateLimiter()
        identifier = "concurrent_test"
        max_requests = 3
        
        async def make_request():
            return limiter.is_allowed(identifier, max_requests, 60)
        
        # 同時に5つのリクエストを送信
        tasks = [make_request() for _ in range(5)]
        results = await asyncio.gather(*tasks)
        
        # 3つまでが許可され、2つが拒否される
        allowed_count = sum(results)
        assert allowed_count == max_requests 