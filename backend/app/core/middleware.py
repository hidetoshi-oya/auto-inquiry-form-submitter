from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
from typing import Callable
import logging

from .security import (
    SecurityConfig, 
    rate_limiter, 
    InputSanitizer,
    robots_checker
)

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """セキュリティヘッダー追加ミドルウェア"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # セキュリティヘッダーを追加
        for header, value in SecurityConfig.SECURITY_HEADERS.items():
            response.headers[header] = value
            
        # HSTSヘッダーはHTTPS接続時のみ
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = SecurityConfig.SECURITY_HEADERS["Strict-Transport-Security"]
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """レート制限ミドルウェア"""
    
    def __init__(self, app, exempt_paths: list = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or ["/health", "/docs", "/openapi.json"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 除外パスをチェック
        if any(request.url.path.startswith(path) for path in self.exempt_paths):
            return await call_next(request)
        
        # クライアント識別子を作成（IPアドレス + User-Agent）
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        identifier = f"{client_ip}:{hash(user_agent)}"
        
        # レート制限チェック
        if not rate_limiter.is_allowed(identifier):
            remaining = rate_limiter.get_remaining_requests(identifier)
            
            logger.warning(f"Rate limit exceeded for {client_ip} - Path: {request.url.path}")
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": "Too many requests. Please try again later.",
                    "remaining_requests": remaining,
                    "retry_after": SecurityConfig.RATE_LIMIT_WINDOW
                },
                headers={
                    "Retry-After": str(SecurityConfig.RATE_LIMIT_WINDOW),
                    "X-RateLimit-Limit": str(SecurityConfig.RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(int(time.time() + SecurityConfig.RATE_LIMIT_WINDOW))
                }
            )
        
        response = await call_next(request)
        
        # レート制限情報をヘッダーに追加
        remaining = rate_limiter.get_remaining_requests(identifier)
        response.headers["X-RateLimit-Limit"] = str(SecurityConfig.RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + SecurityConfig.RATE_LIMIT_WINDOW))
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """クライアントIPアドレスを取得"""
        # X-Forwarded-For ヘッダーをチェック（プロキシ経由の場合）
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # 複数のIPがある場合は最初のものを使用
            return forwarded_for.split(",")[0].strip()
        
        # X-Real-IP ヘッダーをチェック
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # 直接接続の場合
        return request.client.host if request.client else "unknown"


class InputValidationMiddleware(BaseHTTPMiddleware):
    """入力検証ミドルウェア"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # POST, PUT, PATCH リクエストの場合のみ検証
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                # Content-Typeチェック
                content_type = request.headers.get("content-type", "")
                
                if content_type.startswith("application/json"):
                    # JSONペイロードサイズ制限
                    content_length = request.headers.get("content-length")
                    if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB制限
                        return JSONResponse(
                            status_code=413,
                            content={"error": "Request payload too large"}
                        )
                
                # 危険なUser-Agentをチェック
                user_agent = request.headers.get("user-agent", "")
                if self._is_suspicious_user_agent(user_agent):
                    logger.warning(f"Suspicious User-Agent detected: {user_agent}")
                    return JSONResponse(
                        status_code=403,
                        content={"error": "Forbidden"}
                    )
                
            except Exception as e:
                logger.error(f"Input validation error: {e}")
                return JSONResponse(
                    status_code=400,
                    content={"error": "Invalid request format"}
                )
        
        return await call_next(request)
    
    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """疑わしいUser-Agentをチェック"""
        suspicious_patterns = [
            "sqlmap",
            "nikto",
            "netsparker",
            "acunetix",
            "burp",
            "nmap",
            "masscan",
            "python-requests",  # 自動化ツールの可能性
            "curl/",           # cURLの直接使用
            "wget/",           # wgetの使用
            "<script",         # XSS試行
            "javascript:",     # JavaScript URI
            "vbscript:",       # VBScript URI
        ]
        
        user_agent_lower = user_agent.lower()
        return any(pattern in user_agent_lower for pattern in suspicious_patterns)


class LoggingMiddleware(BaseHTTPMiddleware):
    """セキュリティログミドルウェア"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # リクエスト情報をログ
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"from {client_ip} - User-Agent: {user_agent}"
        )
        
        response = await call_next(request)
        
        # レスポンス時間を計算
        process_time = time.time() - start_time
        
        # セキュリティ関連のログ
        if response.status_code >= 400:
            logger.warning(
                f"HTTP {response.status_code}: {request.method} {request.url.path} "
                f"from {client_ip} - Time: {process_time:.3f}s"
            )
        
        # レスポンス時間をヘッダーに追加
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """クライアントIPアドレスを取得"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        return request.client.host if request.client else "unknown"


class RobotsTxtMiddleware(BaseHTTPMiddleware):
    """robots.txt準拠チェックミドルウェア"""
    
    def __init__(self, app, check_paths: list = None):
        super().__init__(app)
        # フォーム検出・送信時のみチェック
        self.check_paths = check_paths or ["/api/forms/detect", "/api/forms/submit"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 対象パスかチェック
        if not any(request.url.path.startswith(path) for path in self.check_paths):
            return await call_next(request)
        
        # リクエストボディからURLを取得（必要に応じて）
        try:
            if request.method == "POST":
                # この時点ではボディを読み取れないため、
                # 実際の実装では依存性注入でチェックを行う
                pass
        except Exception:
            pass
        
        return await call_next(request) 