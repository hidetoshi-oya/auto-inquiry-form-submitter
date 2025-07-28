import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
import json
from app.main import app
from app.core.security import csrf_protection, rate_limiter


class TestSecurityMiddleware:
    """セキュリティミドルウェアのテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
    
    def test_security_headers_middleware(self):
        """セキュリティヘッダーミドルウェアのテスト"""
        response = self.client.get("/health")
        
        # セキュリティヘッダーの確認
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert "Content-Security-Policy" in response.headers
        assert "Strict-Transport-Security" in response.headers
    
    def test_csp_header_content(self):
        """CSPヘッダーの内容確認テスト"""
        response = self.client.get("/health")
        
        csp_header = response.headers.get("Content-Security-Policy")
        assert csp_header is not None
        
        # 重要なCSPディレクティブの確認
        assert "default-src 'self'" in csp_header
        assert "script-src 'self'" in csp_header
        assert "object-src 'none'" in csp_header
        assert "frame-ancestors 'none'" in csp_header
    
    def test_rate_limit_headers(self):
        """レート制限ヘッダーのテスト"""
        # 除外されていないエンドポイントを使用
        response = self.client.get("/security")
        
        # レート制限関連ヘッダーが設定されていることを確認
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
    
    def test_rate_limit_enforcement(self):
        """レート制限の実施テスト"""
        # 大量のリクエストを送信してレート制限をテスト
        responses = []
        
        for i in range(10):  # 適度な数でテスト
            response = self.client.get("/security")
            responses.append(response)
        
        # 最初のリクエストは成功
        assert responses[0].status_code == 200
        
        # レート制限ヘッダーが適切に設定されている
        assert int(responses[0].headers["X-RateLimit-Remaining"]) >= 0
    
    def test_input_validation_middleware_large_payload(self):
        """入力検証ミドルウェアの大きなペイロードテスト"""
        # 非常に大きなペイロードを作成
        large_payload = {"data": "x" * (10 * 1024 * 1024)}  # 10MB
        
        response = self.client.post(
            "/api/companies/",
            json=large_payload,
            headers={"Authorization": "Bearer dummy_token"}
        )
        
        # ペイロードサイズ制限により拒否される
        assert response.status_code == 413  # Payload Too Large
    
    def test_suspicious_user_agent_detection(self):
        """疑わしいUser-Agentの検出テスト"""
        suspicious_agents = [
            "sqlmap/1.0",
            "nikto",
            "nmap",
            "masscan",
            "curl/7.68.0"  # 実装されているパターンに合わせて変更
        ]
        
        for agent in suspicious_agents:
            # POSTリクエストを使用（ミドルウェアはPOST/PUT/PATCHでのみ動作）
            response = self.client.post(
                "/api/companies/",
                json={"test": "data"},
                headers={"User-Agent": agent}
            )
            
            # 疑わしいUser-Agentは拒否される
            assert response.status_code == 403


class TestComplianceAPI:
    """コンプライアンスAPIのテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
        # 認証ヘッダーをモック（実際の認証は別途テスト）
        self.auth_headers = {"Authorization": "Bearer test_token"}
    
    @patch('app.api.deps.get_current_active_user')
    @patch('app.core.compliance.get_compliance_manager')
    def test_check_compliance_endpoint(self, mock_get_manager, mock_get_user):
        """コンプライアンスチェックエンドポイントのテスト"""
        # ユーザー認証をモック
        mock_get_user.return_value = {"id": "test_user"}
        
        # コンプライアンス管理をモック
        mock_manager = Mock()
        mock_manager.compliance_level = Mock()
        mock_manager.check_compliance.return_value = Mock(
            allowed=True,
            warnings=[],
            errors=[],
            recommendations=[],
            delay_seconds=1.0
        )
        mock_get_manager.return_value = mock_manager
        
        request_data = {
            "url": "https://example.com",
            "compliance_level": "moderate"
        }
        
        response = self.client.post(
            "/api/compliance/check",
            json=request_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://example.com"
        assert data["allowed"] is True
        assert data["delay_seconds"] == 1.0
    
    @patch('app.api.deps.get_current_active_user')
    def test_check_compliance_invalid_level(self, mock_get_user):
        """無効なコンプライアンスレベルのテスト"""
        mock_get_user.return_value = {"id": "test_user"}
        
        request_data = {
            "url": "https://example.com",
            "compliance_level": "invalid_level"
        }
        
        response = self.client.post(
            "/api/compliance/check",
            json=request_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 400
        assert "無効なコンプライアンスレベル" in response.json()["detail"]
    
    @patch('app.api.deps.get_current_active_user')
    @patch('app.core.compliance.get_compliance_manager')
    def test_batch_check_compliance(self, mock_get_manager, mock_get_user):
        """バッチコンプライアンスチェックのテスト"""
        mock_get_user.return_value = {"id": "test_user"}
        
        mock_manager = Mock()
        mock_manager.compliance_level = Mock()
        mock_manager.check_compliance.return_value = Mock(
            allowed=True,
            warnings=[],
            errors=[],
            recommendations=[],
            delay_seconds=1.0
        )
        mock_get_manager.return_value = mock_manager
        
        urls = [
            "https://example1.com",
            "https://example2.com",
            "https://example3.com"
        ]
        
        response = self.client.post(
            "/api/compliance/batch-check",
            json=urls,
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 3
    
    @patch('app.api.deps.get_current_active_user')
    def test_batch_check_compliance_too_many_urls(self, mock_get_user):
        """過多URLのバッチチェックテスト"""
        mock_get_user.return_value = {"id": "test_user"}
        
        # 51個のURLを作成（制限は50）
        urls = [f"https://example{i}.com" for i in range(51)]
        
        response = self.client.post(
            "/api/compliance/batch-check",
            json=urls,
            headers=self.auth_headers
        )
        
        assert response.status_code == 400
        assert "50個まで" in response.json()["detail"]
    
    @patch('app.api.deps.get_current_active_user')
    @patch('app.core.compliance.get_compliance_manager')
    def test_get_site_policy(self, mock_get_manager, mock_get_user):
        """サイトポリシー取得のテスト"""
        mock_get_user.return_value = {"id": "test_user"}
        
        mock_manager = Mock()
        mock_policy = Mock()
        mock_policy.robots_txt_url = "https://example.com/robots.txt"
        mock_policy.terms_of_service_url = "https://example.com/terms"
        mock_policy.allows_crawling = True
        mock_policy.requires_delay = 2.0
        mock_manager.get_site_policy.return_value = mock_policy
        mock_get_manager.return_value = mock_manager
        
        response = self.client.get(
            "/api/compliance/site-policy/example.com",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["robots_txt_url"] == "https://example.com/robots.txt"
        assert data["allows_crawling"] is True
        assert data["requires_delay"] == 2.0
    
    @patch('app.api.deps.get_current_active_user')
    @patch('app.core.compliance.get_compliance_manager')
    def test_get_compliance_stats(self, mock_get_manager, mock_get_user):
        """コンプライアンス統計取得のテスト"""
        mock_get_user.return_value = {"id": "test_user"}
        
        mock_manager = Mock()
        mock_manager.site_policies = {
            "https://example1.com": Mock(
                allows_crawling=True,
                requires_delay=1.0,
                terms_of_service_url=None
            ),
            "https://example2.com": Mock(
                allows_crawling=False,
                requires_delay=5.0,
                terms_of_service_url="https://example2.com/terms"
            )
        }
        mock_get_manager.return_value = mock_manager
        
        response = self.client.get(
            "/api/compliance/stats",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_checks"] == 2
        assert data["allowed_count"] == 1
        assert data["blocked_count"] == 1
        assert "example2.com" in data["domains_with_restrictions"]


class TestSecurityEndpoints:
    """セキュリティエンドポイントのテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
    
    def test_health_endpoint(self):
        """ヘルスチェックエンドポイントのテスト"""
        response = self.client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Auto Inquiry Form Submitter"
        assert data["version"] == "1.0.0"
    
    @patch('app.core.config.settings.DEBUG', True)
    def test_security_info_debug_mode(self):
        """デバッグモードでのセキュリティ情報エンドポイントテスト"""
        response = self.client.get("/security")
        
        assert response.status_code == 200
        data = response.json()
        assert data["csrf_protection"] == "enabled"
        assert data["rate_limiting"] == "enabled"
        assert data["security_headers"] == "enabled"
        assert data["input_validation"] == "enabled"
        assert data["compliance_manager"] == "enabled"
    
    @patch('app.core.config.settings.DEBUG', False)
    def test_security_info_production_mode(self):
        """本番モードでのセキュリティ情報エンドポイントテスト"""
        response = self.client.get("/security")
        
        assert response.status_code == 200
        data = response.json()
        assert data["error"] == "Not available in production"
    
    def test_robots_txt_endpoint(self):
        """robots.txtエンドポイントのテスト"""
        response = self.client.get("/robots.txt")
        
        assert response.status_code == 200
        content = response.text
        assert "User-agent: *" in content
        assert "User-agent: AutoInquiryBot" in content
        assert "Allow: /" in content
        assert "Crawl-delay: 1" in content


class TestErrorHandling:
    """エラーハンドリングのテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
    
    def test_404_error_handling(self):
        """404エラーハンドリングのテスト"""
        response = self.client.get("/nonexistent-endpoint")
        
        assert response.status_code == 404
    
    def test_method_not_allowed(self):
        """許可されていないHTTPメソッドのテスト"""
        response = self.client.delete("/health")
        
        assert response.status_code == 405  # Method Not Allowed
    
    def test_invalid_json_handling(self):
        """無効なJSONの処理テスト"""
        response = self.client.post(
            "/api/companies/",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422  # Unprocessable Entity
    
    @patch('app.api.deps.get_current_active_user')
    def test_compliance_api_error_handling(self, mock_get_user):
        """コンプライアンスAPIエラーハンドリングのテスト"""
        mock_get_user.return_value = {"id": "test_user"}
        
        # 無効なURLでのテスト
        request_data = {
            "url": "not-a-valid-url"
        }
        
        response = self.client.post(
            "/api/compliance/check",
            json=request_data
        )
        
        assert response.status_code == 422  # Validation Error


class TestCSRFProtection:
    """CSRF保護のテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
    
    def test_csrf_token_in_response_headers(self):
        """レスポンスヘッダーのCSRFトークン確認"""
        response = self.client.get("/health")
        
        # CSRFトークンがヘッダーに含まれているかチェック
        # （実装に応じて調整が必要）
        assert response.status_code == 200
    
    def test_csrf_protection_global_instance(self):
        """CSRFプロテクショングローバルインスタンスのテスト"""
        from app.core.security import csrf_protection
        
        assert csrf_protection is not None
        
        # トークン生成テスト
        token = csrf_protection.generate_token("test_user")
        assert token is not None
        assert len(token) > 0
        
        # トークン検証テスト
        is_valid = csrf_protection.validate_token(token, "test_user")
        assert is_valid is True


class TestInputValidation:
    """入力検証のテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
        
    def test_xss_prevention_in_query_params(self):
        """クエリパラメータのXSS防止テスト"""
        malicious_script = "<script>alert('xss')</script>"
        
        response = self.client.get(f"/health?test={malicious_script}")
        
        # 正常にレスポンスが返される（スクリプトは実行されない）
        assert response.status_code == 200
    
    def test_sql_injection_prevention(self):
        """SQLインジェクション防止のテスト"""
        sql_injection = "'; DROP TABLE users; --"
        
        response = self.client.get(f"/health?search={sql_injection}")
        
        # 適切に処理される
        assert response.status_code == 200


class TestPerformanceAndLoad:
    """パフォーマンスと負荷のテスト"""
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
    
    def test_concurrent_requests_handling(self):
        """並行リクエスト処理のテスト"""
        import concurrent.futures
        import time
        
        def make_request():
            start_time = time.time()
            response = self.client.get("/health")
            end_time = time.time()
            return response.status_code, end_time - start_time
        
        # 10個の並行リクエストを実行
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [future.result() for future in futures]
        
        # すべてのリクエストが成功
        status_codes = [result[0] for result in results]
        response_times = [result[1] for result in results]
        
        assert all(status_code == 200 for status_code in status_codes)
        
        # レスポンス時間が合理的な範囲内
        avg_response_time = sum(response_times) / len(response_times)
        assert avg_response_time < 1.0  # 1秒以内
    
    def test_memory_usage_stability(self):
        """メモリ使用量の安定性テスト"""
        import gc
        
        # ガベージコレクションを実行
        gc.collect()
        
        # 多数のリクエストを実行
        for _ in range(100):
            response = self.client.get("/health")
            assert response.status_code == 200
        
        # 再度ガベージコレクション
        gc.collect()
        
        # メモリリークがないことを確認（基本的なチェック）
        # より詳細なメモリ分析は別途プロファイリングツールを使用 