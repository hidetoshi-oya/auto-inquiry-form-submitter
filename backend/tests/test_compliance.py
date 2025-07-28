import pytest
import asyncio
import time
from unittest.mock import patch, MagicMock, Mock
from app.core.compliance import (
    ComplianceLevel,
    ComplianceCheck,
    SitePolicy,
    BackoffStrategy,
    TermsOfServiceDetector,
    ComplianceManager,
    compliance_manager,
    check_url_compliance
)


class TestBackoffStrategy:
    """バックオフ戦略のテスト"""
    
    def test_initial_delay(self):
        """初期遅延のテスト"""
        backoff = BackoffStrategy(base_delay=1.0)
        
        delay = backoff.get_delay()
        
        assert delay == 1.0
    
    def test_exponential_backoff(self):
        """指数バックオフのテスト"""
        backoff = BackoffStrategy(base_delay=1.0, multiplier=2.0)
        
        # 失敗を記録
        backoff.record_failure()
        delay1 = backoff.get_delay()
        
        backoff.record_failure()
        delay2 = backoff.get_delay()
        
        backoff.record_failure()
        delay3 = backoff.get_delay()
        
        # 指数的に増加することを確認
        assert delay1 > 1.0
        assert delay2 > delay1
        assert delay3 > delay2
    
    def test_max_delay_limit(self):
        """最大遅延制限のテスト"""
        backoff = BackoffStrategy(base_delay=1.0, max_delay=5.0, multiplier=10.0)
        
        # 多数の失敗を記録
        for _ in range(10):
            backoff.record_failure()
        
        # 複数回テストしてジッターの範囲内であることを確認
        delays = [backoff.get_delay() for _ in range(10)]
        
        # ジッターを考慮して少し余裕を持たせる（最大5.5秒まで許容）
        for delay in delays:
            assert delay <= 5.5, f"Delay {delay} exceeds maximum limit with jitter"
    
    def test_success_reset(self):
        """成功時のリセットテスト"""
        backoff = BackoffStrategy(base_delay=1.0)
        
        # 失敗を記録
        backoff.record_failure()
        backoff.record_failure()
        high_delay = backoff.get_delay()
        
        # 成功を記録
        backoff.record_success()
        low_delay = backoff.get_delay()
        
        # 成功後の遅延が減少することを確認
        assert low_delay < high_delay
    
    def test_failure_expiry(self):
        """失敗記録の有効期限テスト"""
        backoff = BackoffStrategy(base_delay=1.0)
        
        # 過去の失敗を手動で追加
        old_time = time.time() - 86500  # 24時間以上前
        backoff.failure_timestamps = [old_time]
        
        # 現在の遅延を確認（古い失敗は無視される）
        delay = backoff.get_delay()
        assert delay == 1.0
    
    def test_jitter_randomness(self):
        """ジッターのランダム性テスト"""
        backoff = BackoffStrategy(base_delay=10.0)
        
        # 同じ条件で複数回遅延を取得
        backoff.record_failure()
        delays = [backoff.get_delay() for _ in range(10)]
        
        # すべて異なる値であることを確認（ジッターにより）
        unique_delays = set(delays)
        assert len(unique_delays) > 1


class TestTermsOfServiceDetector:
    """利用規約検出器のテスト"""
    
    def test_detect_terms_url_japanese(self):
        """日本語利用規約URLの検出テスト"""
        detector = TermsOfServiceDetector()
        base_url = "https://example.com"
        html_content = '''
        <html>
            <body>
                <footer>
                    <a href="/terms">利用規約</a>
                    <a href="/privacy">プライバシーポリシー</a>
                </footer>
            </body>
        </html>
        '''
        
        url = detector.detect_terms_of_service_url(base_url, html_content)
        
        assert url == "https://example.com/terms"
    
    def test_detect_terms_url_english(self):
        """英語利用規約URLの検出テスト"""
        detector = TermsOfServiceDetector()
        base_url = "https://example.com"
        html_content = '''
        <html>
            <body>
                <footer>
                    <a href="/terms-of-service">Terms of Service</a>
                    <a href="/privacy">Privacy Policy</a>
                </footer>
            </body>
        </html>
        '''
        
        url = detector.detect_terms_of_service_url(base_url, html_content)
        
        assert url == "https://example.com/terms-of-service"
    
    def test_no_terms_url_found(self):
        """利用規約URLが見つからない場合のテスト"""
        detector = TermsOfServiceDetector()
        base_url = "https://example.com"
        html_content = '''
        <html>
            <body>
                <footer>
                    <a href="/contact">Contact</a>
                    <a href="/about">About</a>
                </footer>
            </body>
        </html>
        '''
        
        url = detector.detect_terms_of_service_url(base_url, html_content)
        
        assert url is None
    
    def test_relative_url_conversion(self):
        """相対URLの絶対URL変換テスト"""
        detector = TermsOfServiceDetector()
        base_url = "https://example.com/path/"
        html_content = '''
        <html>
            <body>
                <a href="../terms">利用規約</a>
            </body>
        </html>
        '''
        
        url = detector.detect_terms_of_service_url(base_url, html_content)
        
        assert url == "https://example.com/terms"
    
    @patch('app.core.compliance.requests.get')
    def test_analyze_terms_automation_prohibited(self, mock_get):
        """自動化禁止の利用規約解析テスト"""
        detector = TermsOfServiceDetector()
        
        # 自動化を禁止する利用規約のモック
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = """
        Terms of Service
        
        You may not use automated scripts, bots, or other programmatic methods
        to access our services. Such activities are strictly prohibited.
        """
        mock_get.return_value = mock_response
        
        result = detector.analyze_terms_of_service("https://example.com/terms")
        
        assert result.allowed is False
        assert len(result.errors) > 0
        assert any("自動化が禁止" in error for error in result.errors)
    
    @patch('app.core.compliance.requests.get')
    def test_analyze_terms_automation_mentioned_only(self, mock_get):
        """自動化言及のみの利用規約解析テスト"""
        detector = TermsOfServiceDetector()
        
        # 自動化について言及するが禁止していない利用規約
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = """
        Terms of Service
        
        We support automated tools and bots for legitimate use cases.
        Please ensure your scripts follow our API guidelines.
        """
        mock_get.return_value = mock_response
        
        result = detector.analyze_terms_of_service("https://example.com/terms")
        
        assert result.allowed is True
        assert len(result.warnings) > 0
        assert any("自動化に関する記述" in warning for warning in result.warnings)
    
    @patch('app.core.compliance.requests.get')
    def test_analyze_terms_network_error(self, mock_get):
        """ネットワークエラー時の利用規約解析テスト"""
        detector = TermsOfServiceDetector()
        
        # ネットワークエラーのシミュレーション
        mock_get.side_effect = Exception("Network error")
        
        result = detector.analyze_terms_of_service("https://example.com/terms")
        
        assert result.allowed is True  # エラー時は許可
        assert len(result.warnings) > 0
        assert any("解析中にエラー" in warning for warning in result.warnings)


class TestComplianceManager:
    """コンプライアンス管理のテスト"""
    
    def test_compliance_manager_initialization(self):
        """コンプライアンス管理の初期化テスト"""
        manager = ComplianceManager(ComplianceLevel.STRICT)
        
        assert manager.compliance_level == ComplianceLevel.STRICT
        assert len(manager.site_policies) == 0
        assert len(manager.backoff_strategies) == 0
        assert manager.user_agent == "AutoInquiryBot/1.0 (+https://example.com/bot-info)"
    
    @patch('app.core.compliance.requests.get')
    def test_get_site_policy_with_robots_txt(self, mock_get):
        """robots.txt有りのサイトポリシー取得テスト"""
        manager = ComplianceManager()
        
        # robots.txtのモック
        def mock_response(url, **kwargs):
            response = Mock()
            if 'robots.txt' in url:
                response.status_code = 200
                response.text = """
                User-agent: *
                Disallow: /admin
                Crawl-delay: 5
                
                User-agent: AutoInquiryBot
                Allow: /
                Crawl-delay: 2
                """
            else:
                response.status_code = 200
                response.text = """
                <html>
                    <body>
                        <a href="/terms">利用規約</a>
                    </body>
                </html>
                """
            return response
        
        mock_get.side_effect = mock_response
        
        policy = manager.get_site_policy("https://example.com")
        
        assert policy.robots_txt_url == "https://example.com/robots.txt"
        assert policy.allows_crawling is True
        assert policy.requires_delay == 2.0  # AutoInquiryBotに対する設定
        assert policy.terms_of_service_url == "https://example.com/terms"
    
    @patch('app.core.compliance.requests.get')
    def test_get_site_policy_robots_disallow_all(self, mock_get):
        """robots.txtで全面禁止のサイトポリシーテスト"""
        manager = ComplianceManager()
        
        def mock_response(url, **kwargs):
            response = Mock()
            if 'robots.txt' in url:
                response.status_code = 200
                response.text = """
                User-agent: *
                Disallow: /
                """
            else:
                response.status_code = 200
                response.text = "<html><body>No terms found</body></html>"
            return response
        
        mock_get.side_effect = mock_response
        
        policy = manager.get_site_policy("https://example.com")
        
        assert policy.allows_crawling is False
    
    @pytest.mark.asyncio
    async def test_check_compliance_strict_mode(self):
        """厳格モードでのコンプライアンスチェックテスト"""
        manager = ComplianceManager(ComplianceLevel.STRICT)
        
        # robots.txtで禁止されているサイトのモック
        with patch.object(manager, 'get_site_policy') as mock_policy:
            mock_policy.return_value = SitePolicy(
                robots_txt_url="https://example.com/robots.txt",
                allows_crawling=False,
                requires_delay=1.0
            )
            
            result = await manager.check_compliance("https://example.com")
            
            assert result.allowed is False
            assert len(result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_check_compliance_moderate_mode(self):
        """中程度モードでのコンプライアンスチェックテスト"""
        manager = ComplianceManager(ComplianceLevel.MODERATE)
        
        with patch.object(manager, 'get_site_policy') as mock_policy:
            mock_policy.return_value = SitePolicy(
                robots_txt_url="https://example.com/robots.txt",
                allows_crawling=False,
                requires_delay=1.0
            )
            
            result = await manager.check_compliance("https://example.com")
            
            assert result.allowed is True  # 中程度モードでは警告のみ
            assert len(result.warnings) > 0
    
    def test_record_request_result_success(self):
        """リクエスト成功記録テスト"""
        manager = ComplianceManager()
        url = "https://example.com"
        
        # 失敗を記録してから成功を記録
        manager.record_request_result(url, False)
        manager.record_request_result(url, True)
        
        # バックオフ戦略が作成されることを確認
        domain = "https://example.com"
        assert domain in manager.backoff_strategies
    
    def test_get_recommended_headers(self):
        """推奨ヘッダー取得テスト"""
        manager = ComplianceManager()
        
        headers = manager.get_recommended_headers("https://example.com")
        
        expected_headers = [
            'User-Agent',
            'Accept',
            'Accept-Language',
            'Accept-Encoding',
            'DNT',
            'Connection',
            'Cache-Control'
        ]
        
        for header in expected_headers:
            assert header in headers
        
        assert headers['User-Agent'] == manager.user_agent
        assert headers['DNT'] == '1'


class TestComplianceIntegration:
    """コンプライアンス統合テスト"""
    
    def test_global_compliance_manager(self):
        """グローバルコンプライアンス管理インスタンスのテスト"""
        assert compliance_manager is not None
        assert isinstance(compliance_manager, ComplianceManager)
        assert compliance_manager.compliance_level == ComplianceLevel.MODERATE
    
    @pytest.mark.asyncio
    async def test_check_url_compliance_function(self):
        """URL コンプライアンスチェック関数のテスト"""
        # 実際のWebサイトを使用するのではなく、モックを使用
        with patch.object(compliance_manager, 'check_compliance') as mock_check:
            mock_check.return_value = ComplianceCheck(
                allowed=True,
                warnings=[],
                errors=[],
                recommendations=[],
                delay_seconds=1.0
            )
            
            result = await check_url_compliance("https://example.com")
            
            assert result.allowed is True
            assert result.delay_seconds == 1.0
    
    @pytest.mark.asyncio
    async def test_compliance_with_backoff_integration(self):
        """コンプライアンスとバックオフの統合テスト"""
        manager = ComplianceManager()
        url = "https://example.com"
        
        # 複数回失敗を記録
        for _ in range(3):
            manager.record_request_result(url, False)
        
        # コンプライアンスチェック時に高い遅延が適用されることを確認
        with patch.object(manager, 'get_site_policy') as mock_policy:
            mock_policy.return_value = SitePolicy(
                robots_txt_url=f"{url}/robots.txt",
                allows_crawling=True,
                requires_delay=1.0
            )
            
            result = await manager.check_compliance(url)
            
            # バックオフによる遅延が適用される
            assert result.delay_seconds > 1.0
    
    def test_compliance_levels_enum(self):
        """コンプライアンスレベル列挙型のテスト"""
        assert ComplianceLevel.STRICT.value == "strict"
        assert ComplianceLevel.MODERATE.value == "moderate"
        assert ComplianceLevel.PERMISSIVE.value == "permissive"
    
    @pytest.mark.asyncio
    async def test_multiple_domains_isolation(self):
        """複数ドメインの分離テスト"""
        manager = ComplianceManager()
        
        domain1 = "https://example1.com"
        domain2 = "https://example2.com"
        
        # ドメイン1で失敗を記録
        manager.record_request_result(domain1, False)
        manager.record_request_result(domain1, False)
        
        # ドメイン2は影響を受けないことを確認
        domain2_parsed = "https://example2.com"
        assert domain2_parsed not in manager.backoff_strategies
        
        # ドメイン1のバックオフ戦略が作成されていることを確認
        domain1_parsed = "https://example1.com"
        assert domain1_parsed in manager.backoff_strategies


class TestRealWorldScenarios:
    """実世界シナリオのテスト"""
    
    @pytest.mark.asyncio
    async def test_high_traffic_scenario(self):
        """高トラフィックシナリオのテスト"""
        manager = ComplianceManager()
        
        # 同一ドメインに対する連続アクセス
        url = "https://example.com"
        
        with patch.object(manager, 'get_site_policy') as mock_policy:
            mock_policy.return_value = SitePolicy(
                robots_txt_url=f"{url}/robots.txt",
                allows_crawling=True,
                requires_delay=1.0
            )
            
            # 最初のアクセス
            result1 = await manager.check_compliance(url)
            
            # 失敗を記録してからの次のアクセス
            manager.record_request_result(url, False)
            result2 = await manager.check_compliance(url)
            
            # 2回目は遅延が増加していることを確認
            assert result2.delay_seconds > result1.delay_seconds
    
    @pytest.mark.asyncio 
    async def test_mixed_compliance_results(self):
        """複合的なコンプライアンス結果のテスト"""
        manager = ComplianceManager(ComplianceLevel.MODERATE)
        
        with patch.object(manager, 'get_site_policy') as mock_policy, \
             patch.object(manager.tos_detector, 'analyze_terms_of_service') as mock_tos:
            
            # robots.txtでは許可、利用規約で警告
            mock_policy.return_value = SitePolicy(
                robots_txt_url="https://example.com/robots.txt",
                terms_of_service_url="https://example.com/terms",
                allows_crawling=True,
                requires_delay=2.0
            )
            
            mock_tos.return_value = ComplianceCheck(
                allowed=True,
                warnings=["自動化に関する記述が見つかりました"],
                errors=[],
                recommendations=["詳細確認を推奨"]
            )
            
            result = await manager.check_compliance("https://example.com")
            
            assert result.allowed is True
            assert len(result.warnings) > 0
            assert len(result.recommendations) > 0
            assert result.delay_seconds >= 2.0
    
    def test_memory_management(self):
        """メモリ管理のテスト"""
        manager = ComplianceManager()
        
        # 大量のドメインに対するリクエストをシミュレート
        for i in range(100):
            domain = f"https://example{i}.com"
            manager.record_request_result(domain, i % 2 == 0)  # 50%成功
        
        # バックオフ戦略が適切に管理されていることを確認
        assert len(manager.backoff_strategies) == 100
        
        # 成功記録によりリセットされたものを確認
        success_domains = [f"https://example{i}.com" for i in range(0, 100, 2)]
        for domain in success_domains:
            backoff = manager.backoff_strategies[domain]
            # 成功により失敗タイムスタンプが減少していることを確認
            recent_failures = [ts for ts in backoff.failure_timestamps if time.time() - ts < 600]
            assert len(recent_failures) == 0 