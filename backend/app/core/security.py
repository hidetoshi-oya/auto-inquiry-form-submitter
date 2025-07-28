from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

from pydantic import BaseModel
import secrets
import time
from collections import defaultdict
import re
import requests
from urllib.parse import urlparse
import hashlib
import hmac
import ipaddress


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """アクセストークンの生成"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """パスワードの検証"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """パスワードのハッシュ化"""
    return pwd_context.hash(password)


class SecurityConfig:
    """セキュリティ設定"""
    
    # CSRF設定
    CSRF_TOKEN_LENGTH = 32
    CSRF_TOKEN_EXPIRY = 3600  # 1時間
    
    # XSS防止設定
    CSP_POLICY = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' https:; "
        "connect-src 'self'; "
        "media-src 'self'; "
        "object-src 'none'; "
        "child-src 'none'; "
        "worker-src 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "base-uri 'self'"
    )
    
    # セキュリティヘッダー
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        "Content-Security-Policy": CSP_POLICY
    }
    
    # レート制限設定
    RATE_LIMIT_REQUESTS = 100  # リクエスト数
    RATE_LIMIT_WINDOW = 3600   # 時間窓（秒）
    
    # robots.txt 準拠チェック
    ROBOTS_TXT_CACHE_TIME = 3600  # 1時間


class CSRFProtection:
    """CSRF保護機能"""
    
    def __init__(self):
        self.tokens: Dict[str, Dict] = {}
        
    def generate_token(self, user_id: str) -> str:
        """CSRFトークンを生成"""
        token = secrets.token_urlsafe(SecurityConfig.CSRF_TOKEN_LENGTH)
        expires_at = datetime.utcnow() + timedelta(seconds=SecurityConfig.CSRF_TOKEN_EXPIRY)
        
        self.tokens[token] = {
            'user_id': user_id,
            'expires_at': expires_at,
            'created_at': datetime.utcnow()
        }
        
        # 期限切れトークンの削除
        self._cleanup_expired_tokens()
        
        return token
    
    def validate_token(self, token: str, user_id: str) -> bool:
        """CSRFトークンを検証"""
        if not token or token not in self.tokens:
            return False
            
        token_data = self.tokens[token]
        
        # 期限チェック
        if datetime.utcnow() > token_data['expires_at']:
            del self.tokens[token]
            return False
            
        # ユーザーIDチェック
        if token_data['user_id'] != user_id:
            return False
            
        # トークンを使用後削除（ワンタイム）
        del self.tokens[token]
        return True
    
    def _cleanup_expired_tokens(self):
        """期限切れトークンの削除"""
        now = datetime.utcnow()
        expired_tokens = [
            token for token, data in self.tokens.items()
            if now > data['expires_at']
        ]
        for token in expired_tokens:
            del self.tokens[token]


class RateLimiter:
    """レート制限機能"""
    
    def __init__(self):
        self.requests: Dict[str, List[float]] = defaultdict(list)
        
    def is_allowed(self, identifier: str, max_requests: int = None, window: int = None) -> bool:
        """レート制限チェック"""
        max_requests = max_requests or SecurityConfig.RATE_LIMIT_REQUESTS
        window = window or SecurityConfig.RATE_LIMIT_WINDOW
        
        now = time.time()
        user_requests = self.requests[identifier]
        
        # 時間窓外のリクエストを削除
        cutoff_time = now - window
        user_requests[:] = [req_time for req_time in user_requests if req_time > cutoff_time]
        
        # リクエスト数チェック
        if len(user_requests) >= max_requests:
            return False
            
        # 新しいリクエストを記録
        user_requests.append(now)
        return True
    
    def get_remaining_requests(self, identifier: str, max_requests: int = None) -> int:
        """残りリクエスト数を取得"""
        max_requests = max_requests or SecurityConfig.RATE_LIMIT_REQUESTS
        current_requests = len(self.requests[identifier])
        return max(0, max_requests - current_requests)


class InputSanitizer:
    """入力データサニタイザー"""
    
    @staticmethod
    def sanitize_html(text: str) -> str:
        """HTMLエスケープ"""
        if not text:
            return ""
            
        escapes = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        }
        
        for char, escape in escapes.items():
            text = text.replace(char, escape)
            
        return text
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """URL検証"""
        if not url:
            return False
            
        try:
            parsed = urlparse(url)
            
            # プロトコルチェック
            if parsed.scheme not in ['http', 'https']:
                return False
                
            # ホスト名チェック
            if not parsed.netloc:
                return False
                
            # 危険なIPアドレス範囲をチェック
            if InputSanitizer._is_dangerous_ip(parsed.netloc):
                return False
                
            return True
            
        except Exception:
            return False
    
    @staticmethod
    def _is_dangerous_ip(netloc: str) -> bool:
        """危険なIPアドレス範囲のチェック"""
        
        # IPアドレスを抽出
        host = netloc.split(':')[0]  # ポート番号を除去
        
        # 特別なホスト名をチェック
        dangerous_hosts = ['localhost', '127.0.0.1', '0.0.0.0']
        if host.lower() in dangerous_hosts:
            return True
        
        try:
            ip = ipaddress.ip_address(host)
            
            # プライベートIPアドレス範囲
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return True
                
            # その他の危険な範囲
            dangerous_ranges = [
                ipaddress.ip_network('169.254.0.0/16'),  # Link-local
                ipaddress.ip_network('224.0.0.0/4'),    # Multicast
                ipaddress.ip_network('255.255.255.255/32')  # Broadcast
            ]
            
            for network in dangerous_ranges:
                if ip in network:
                    return True
                    
        except ValueError:
            # IPアドレスでない場合（ドメイン名など）
            pass
            
        return False
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """メールアドレス検証"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))


class RobotsTxtChecker:
    """robots.txt準拠チェッカー"""
    
    def __init__(self):
        self.cache: Dict[str, Dict] = {}
        
    def can_fetch(self, url: str, user_agent: str = "*") -> bool:
        """robots.txtに基づいてアクセス可能かチェック"""
        try:
            parsed_url = urlparse(url)
            base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
            robots_url = f"{base_url}/robots.txt"
            
            # キャッシュチェック
            cache_key = base_url
            if cache_key in self.cache:
                cache_data = self.cache[cache_key]
                if time.time() - cache_data['timestamp'] < SecurityConfig.ROBOTS_TXT_CACHE_TIME:
                    return self._check_rules(cache_data['rules'], parsed_url.path, user_agent)
            
            # robots.txtを取得
            rules = self._fetch_robots_txt(robots_url)
            
            # キャッシュに保存
            self.cache[cache_key] = {
                'rules': rules,
                'timestamp': time.time()
            }
            
            return self._check_rules(rules, parsed_url.path, user_agent)
            
        except Exception as e:
            # エラーの場合は保守的にFalseを返す
            return False
    
    def _fetch_robots_txt(self, robots_url: str) -> Dict:
        """robots.txtを取得してパース"""
        try:
            response = requests.get(robots_url, timeout=10)
            if response.status_code != 200:
                return {'disallow': [], 'allow': []}
                
            content = response.text
            rules = {'disallow': [], 'allow': []}
            
            current_user_agent = None
            for line in content.split('\n'):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                    
                if line.lower().startswith('user-agent:'):
                    current_user_agent = line.split(':', 1)[1].strip()
                elif line.lower().startswith('disallow:') and current_user_agent in ['*', 'AutoInquiryBot']:
                    path = line.split(':', 1)[1].strip()
                    if path:
                        rules['disallow'].append(path)
                elif line.lower().startswith('allow:') and current_user_agent in ['*', 'AutoInquiryBot']:
                    path = line.split(':', 1)[1].strip()
                    if path:
                        rules['allow'].append(path)
                        
            return rules
            
        except Exception:
            return {'disallow': [], 'allow': []}
    
    def _check_rules(self, rules: Dict, path: str, user_agent: str) -> bool:
        """ルールに基づいてアクセス可能かチェック"""
        # Allowルールを先にチェック
        for allowed_path in rules.get('allow', []):
            if path.startswith(allowed_path):
                return True
                
        # Disallowルールをチェック
        for disallowed_path in rules.get('disallow', []):
            if path.startswith(disallowed_path):
                return False
                
        return True


class DataEncryption:
    """データ暗号化機能"""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key.encode()
        
    def encrypt_sensitive_data(self, data: str) -> str:
        """機密データの暗号化（HMAC使用）"""
        if not data:
            return ""
            
        # データをハッシュ化
        digest = hmac.new(
            self.secret_key,
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return digest
    
    def verify_sensitive_data(self, data: str, encrypted: str) -> bool:
        """機密データの検証"""
        if not data or not encrypted:
            return False
            
        return hmac.compare_digest(
            self.encrypt_sensitive_data(data),
            encrypted
        )


# グローバルインスタンス
csrf_protection = CSRFProtection()
rate_limiter = RateLimiter()
robots_checker = RobotsTxtChecker()

def get_data_encryption() -> DataEncryption:
    """データ暗号化インスタンスを取得"""
    from .config import settings
    return DataEncryption(settings.SECRET_KEY)