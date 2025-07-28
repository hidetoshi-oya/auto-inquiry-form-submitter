"""
コンプライアンス機能モジュール
- robots.txt準拠チェック
- レート制限とバックオフ戦略
- 利用規約検出と警告システム
"""

import re
import time
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin
from dataclasses import dataclass
from enum import Enum
import requests
from bs4 import BeautifulSoup
import random

logger = logging.getLogger(__name__)


class ComplianceLevel(Enum):
    """コンプライアンスレベル"""
    STRICT = "strict"      # 厳格（疑わしい場合は実行しない）
    MODERATE = "moderate"  # 中程度（警告を出すが実行継続）
    PERMISSIVE = "permissive"  # 寛容（ほとんどの場合実行）


@dataclass
class ComplianceCheck:
    """コンプライアンスチェック結果"""
    allowed: bool
    warnings: List[str]
    errors: List[str]
    recommendations: List[str]
    delay_seconds: float = 0


@dataclass
class SitePolicy:
    """サイトポリシー情報"""
    robots_txt_url: str
    terms_of_service_url: Optional[str] = None
    privacy_policy_url: Optional[str] = None
    contact_url: Optional[str] = None
    allows_crawling: bool = True
    requires_delay: float = 1.0
    user_agent_restrictions: List[str] = None


class BackoffStrategy:
    """バックオフ戦略"""
    
    def __init__(self, base_delay: float = 1.0, max_delay: float = 300.0, multiplier: float = 2.0):
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.multiplier = multiplier
        self.attempt_count = 0
        self.failure_timestamps: List[float] = []
        
    def get_delay(self) -> float:
        """次のリクエストまでの遅延時間を計算"""
        if not self.failure_timestamps:
            return self.base_delay
            
        # 過去1時間の失敗回数をカウント
        now = time.time()
        recent_failures = [ts for ts in self.failure_timestamps if now - ts < 3600]
        
        if len(recent_failures) == 0:
            return self.base_delay
            
        # 指数バックオフ + ジッター
        delay = min(
            self.base_delay * (self.multiplier ** len(recent_failures)),
            self.max_delay
        )
        
        # ジッター（±20%のランダム性）
        jitter = delay * 0.2 * (random.random() - 0.5)
        return max(0.1, delay + jitter)
    
    def record_failure(self):
        """失敗を記録"""
        self.failure_timestamps.append(time.time())
        
        # 古い失敗記録を削除（過去24時間分のみ保持）
        cutoff_time = time.time() - 86400
        self.failure_timestamps = [
            ts for ts in self.failure_timestamps if ts > cutoff_time
        ]
    
    def record_success(self):
        """成功を記録（失敗カウントをリセット）"""
        # 成功時は最近の失敗記録をクリア
        now = time.time()
        # 過去10分以内の失敗のみ残す
        cutoff_time = now - 600
        self.failure_timestamps = [
            ts for ts in self.failure_timestamps if ts > cutoff_time
        ]


class TermsOfServiceDetector:
    """利用規約検出器"""
    
    # 利用規約関連のキーワード
    TOS_KEYWORDS = [
        "terms of service", "terms of use", "user agreement",
        "利用規約", "利用条件", "使用条件", "約款",
        "legal notice", "service agreement"
    ]
    
    # 自動化禁止に関するキーワード
    AUTOMATION_RESTRICTION_KEYWORDS = [
        "bot", "crawler", "scraping", "automated", "robot",
        "machine", "programmatic", "script",
        "ボット", "クローラー", "スクレイピング", "自動", 
        "機械的", "プログラム", "スクリプト"
    ]
    
    # 禁止行為に関するキーワード
    PROHIBITION_KEYWORDS = [
        "prohibited", "forbidden", "not allowed", "ban", "restrict",
        "禁止", "禁ずる", "不可", "制限", "違法"
    ]
    
    def detect_terms_of_service_url(self, base_url: str, html_content: str) -> Optional[str]:
        """利用規約URLを検出"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # リンクテキストから利用規約を検索
            for link in soup.find_all('a', href=True):
                link_text = link.get_text().lower().strip()
                link_href = link['href']
                
                for keyword in self.TOS_KEYWORDS:
                    if keyword in link_text:
                        # 相対URLを絶対URLに変換
                        full_url = urljoin(base_url, link_href)
                        return full_url
                        
            return None
            
        except Exception as e:
            logger.error(f"Terms of service detection error: {e}")
            return None
    
    def analyze_terms_of_service(self, tos_url: str) -> ComplianceCheck:
        """利用規約を解析してコンプライアンスチェック"""
        try:
            response = requests.get(tos_url, timeout=10)
            if response.status_code != 200:
                return ComplianceCheck(
                    allowed=True,
                    warnings=[f"利用規約を取得できませんでした: {tos_url}"],
                    errors=[],
                    recommendations=[]
                )
                
            content = response.text.lower()
            warnings = []
            errors = []
            recommendations = []
            
            # 自動化に関する制限をチェック
            automation_restrictions = []
            for keyword in self.AUTOMATION_RESTRICTION_KEYWORDS:
                if keyword in content:
                    automation_restrictions.append(keyword)
            
            if automation_restrictions:
                # 禁止語句も含まれているかチェック
                has_prohibition = any(
                    prohibition in content 
                    for prohibition in self.PROHIBITION_KEYWORDS
                )
                
                if has_prohibition:
                    errors.append(
                        f"利用規約で自動化が禁止されている可能性があります。"
                        f"検出キーワード: {', '.join(automation_restrictions[:3])}"
                    )
                    recommendations.append(
                        "手動でのアクセスまたは事前許可の取得を検討してください"
                    )
                else:
                    warnings.append(
                        f"自動化に関する記述が見つかりました。詳細確認を推奨します。"
                        f"キーワード: {', '.join(automation_restrictions[:3])}"
                    )
            
            # 連絡先情報の確認
            contact_keywords = ["contact", "support", "inquiry", "連絡", "問い合わせ"]
            has_contact = any(keyword in content for keyword in contact_keywords)
            
            if not has_contact:
                recommendations.append(
                    "連絡先情報が見つかりません。事前に許可を求めることを推奨します"
                )
            
            allowed = len(errors) == 0
            
            return ComplianceCheck(
                allowed=allowed,
                warnings=warnings,
                errors=errors,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Terms of service analysis error: {e}")
            return ComplianceCheck(
                allowed=True,
                warnings=[f"利用規約の解析中にエラーが発生しました: {str(e)}"],
                errors=[],
                recommendations=[]
            )


class ComplianceManager:
    """コンプライアンス管理クラス"""
    
    def __init__(self, compliance_level: ComplianceLevel = ComplianceLevel.MODERATE):
        self.compliance_level = compliance_level
        self.site_policies: Dict[str, SitePolicy] = {}
        self.backoff_strategies: Dict[str, BackoffStrategy] = {}
        self.tos_detector = TermsOfServiceDetector()
        
        # デフォルトのUser-Agent
        self.user_agent = "AutoInquiryBot/1.0 (+https://example.com/bot-info)"
    
    def get_site_policy(self, url: str) -> SitePolicy:
        """サイトポリシーを取得"""
        parsed_url = urlparse(url)
        domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        if domain not in self.site_policies:
            self.site_policies[domain] = self._analyze_site_policy(domain)
            
        return self.site_policies[domain]
    
    def _analyze_site_policy(self, base_url: str) -> SitePolicy:
        """サイトポリシーを解析"""
        robots_txt_url = urljoin(base_url, '/robots.txt')
        
        try:
            # robots.txtを取得
            response = requests.get(robots_txt_url, timeout=10)
            robots_content = response.text if response.status_code == 200 else ""
            
            # メインページを取得して利用規約URLを検出
            main_response = requests.get(base_url, timeout=10)
            main_content = main_response.text if main_response.status_code == 200 else ""
            
            tos_url = self.tos_detector.detect_terms_of_service_url(base_url, main_content)
            
            # robots.txtを解析
            allows_crawling, crawl_delay = self._parse_robots_txt(robots_content)
            
            return SitePolicy(
                robots_txt_url=robots_txt_url,
                terms_of_service_url=tos_url,
                allows_crawling=allows_crawling,
                requires_delay=max(crawl_delay, 1.0)  # 最小1秒
            )
            
        except Exception as e:
            logger.error(f"Site policy analysis error for {base_url}: {e}")
            return SitePolicy(
                robots_txt_url=robots_txt_url,
                allows_crawling=True,
                requires_delay=2.0  # エラー時は保守的に2秒
            )
    
    def _parse_robots_txt(self, content: str) -> Tuple[bool, float]:
        """robots.txtを解析"""
        if not content:
            return True, 1.0
            
        lines = content.split('\n')
        current_user_agent = None
        allows_crawling = True
        crawl_delay = 1.0
        specific_bot_crawl_delay = None  # 特定ボット用の設定
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            if line.lower().startswith('user-agent:'):
                current_user_agent = line.split(':', 1)[1].strip().lower()
            elif current_user_agent == 'autoinquirybot':
                # 特定ボット用の設定を優先
                if line.lower().startswith('disallow:'):
                    disallow_path = line.split(':', 1)[1].strip()
                    if disallow_path == '/':
                        allows_crawling = False
                elif line.lower().startswith('crawl-delay:'):
                    try:
                        specific_bot_crawl_delay = float(line.split(':', 1)[1].strip())
                    except ValueError:
                        pass
            elif current_user_agent == '*' and specific_bot_crawl_delay is None:
                # 全般設定（特定ボット設定がない場合のみ）
                if line.lower().startswith('disallow:'):
                    disallow_path = line.split(':', 1)[1].strip()
                    if disallow_path == '/':
                        allows_crawling = False
                elif line.lower().startswith('crawl-delay:'):
                    try:
                        delay_value = float(line.split(':', 1)[1].strip())
                        crawl_delay = max(crawl_delay, delay_value)
                    except ValueError:
                        pass
        
        # 特定ボット設定があればそれを使用
        if specific_bot_crawl_delay is not None:
            crawl_delay = specific_bot_crawl_delay
                        
        return allows_crawling, crawl_delay
    
    async def check_compliance(self, url: str) -> ComplianceCheck:
        """URLのコンプライアンスをチェック"""
        parsed_url = urlparse(url)
        domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        # サイトポリシーを取得
        policy = self.get_site_policy(url)
        
        warnings = []
        errors = []
        recommendations = []
        delay_seconds = policy.requires_delay
        
        # robots.txtチェック
        if not policy.allows_crawling:
            if self.compliance_level == ComplianceLevel.STRICT:
                errors.append("robots.txtで当該User-Agentのアクセスが禁止されています")
            else:
                warnings.append("robots.txtで制限されている可能性があります")
        
        # バックオフ戦略を適用
        if domain not in self.backoff_strategies:
            self.backoff_strategies[domain] = BackoffStrategy()
            
        backoff = self.backoff_strategies[domain]
        backoff_delay = backoff.get_delay()
        delay_seconds = max(delay_seconds, backoff_delay)
        
        # 利用規約チェック
        if policy.terms_of_service_url:
            tos_check = self.tos_detector.analyze_terms_of_service(policy.terms_of_service_url)
            warnings.extend(tos_check.warnings)
            errors.extend(tos_check.errors)
            recommendations.extend(tos_check.recommendations)
            
            if not tos_check.allowed and self.compliance_level == ComplianceLevel.STRICT:
                errors.append("利用規約により自動アクセスが制限されています")
        else:
            if self.compliance_level == ComplianceLevel.STRICT:
                warnings.append("利用規約が見つかりません。事前確認を推奨します")
        
        # レート制限の推奨事項
        if delay_seconds > 5:
            recommendations.append(f"高頻度アクセスを避け、{delay_seconds}秒以上の間隔を空けてください")
        
        # 最終的な許可判定
        allowed = True
        if self.compliance_level == ComplianceLevel.STRICT and errors:
            allowed = False
        elif self.compliance_level == ComplianceLevel.MODERATE and len(errors) > 2:
            allowed = False
            
        return ComplianceCheck(
            allowed=allowed,
            warnings=warnings,
            errors=errors,
            recommendations=recommendations,
            delay_seconds=delay_seconds
        )
    
    def record_request_result(self, url: str, success: bool):
        """リクエスト結果を記録"""
        parsed_url = urlparse(url)
        domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        if domain not in self.backoff_strategies:
            self.backoff_strategies[domain] = BackoffStrategy()
            
        backoff = self.backoff_strategies[domain]
        
        if success:
            backoff.record_success()
        else:
            backoff.record_failure()
    
    def get_recommended_headers(self, url: str) -> Dict[str, str]:
        """推奨HTTPヘッダーを取得"""
        return {
            'User-Agent': self.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',  # Do Not Track
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
        }


# グローバルインスタンス
compliance_manager = ComplianceManager(ComplianceLevel.MODERATE)


async def check_url_compliance(url: str) -> ComplianceCheck:
    """URL のコンプライアンスをチェック（非同期）"""
    return await compliance_manager.check_compliance(url)


def get_compliance_manager() -> ComplianceManager:
    """コンプライアンス管理インスタンスを取得"""
    return compliance_manager 