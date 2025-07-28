"""
ブラウザプール管理サービス
Playwrightを使用したブラウザインスタンスのプール管理
"""
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
from contextlib import asynccontextmanager

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger(__name__)


class BrowserPoolManager:
    """ブラウザインスタンスのプール管理クラス"""
    
    def __init__(
        self,
        pool_size: int = 10,
        max_pages_per_browser: int = 5,
        browser_timeout: int = 60000,  # 60秒
        headless: bool = True
    ):
        self.pool_size = pool_size
        self.max_pages_per_browser = max_pages_per_browser
        self.browser_timeout = browser_timeout
        self.headless = headless
        self.browsers: List[Dict[str, Any]] = []
        self.playwright = None
        self._lock = asyncio.Lock()
        self._initialized = False
    
    async def initialize(self):
        """ブラウザプールの初期化"""
        if self._initialized:
            return
            
        async with self._lock:
            if self._initialized:
                return
                
            self.playwright = await async_playwright().start()
            logger.info(f"ブラウザプールを初期化中... (サイズ: {self.pool_size})")
            
            for i in range(self.pool_size):
                browser = await self._create_browser()
                self.browsers.append({
                    'browser': browser,
                    'contexts': [],
                    'created_at': datetime.now(),
                    'last_used': datetime.now(),
                    'usage_count': 0
                })
                logger.info(f"ブラウザ {i+1}/{self.pool_size} を作成しました")
            
            self._initialized = True
            logger.info("ブラウザプールの初期化が完了しました")
    
    async def _create_browser(self) -> Browser:
        """新しいブラウザインスタンスを作成"""
        browser = await self.playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu'
            ]
        )
        return browser
    
    @asynccontextmanager
    async def get_page(self, **context_options):
        """利用可能なページを取得（コンテキストマネージャー）"""
        if not self._initialized:
            await self.initialize()
        
        page = None
        browser_info = None
        context = None
        
        try:
            async with self._lock:
                # 最も使用頻度の低いブラウザを選択
                browser_info = min(
                    self.browsers,
                    key=lambda b: len(b['contexts'])
                )
                
                # コンテキストを作成
                context = await browser_info['browser'].new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    **context_options
                )
                
                # ページを作成
                page = await context.new_page()
                page.set_default_timeout(self.browser_timeout)
                
                # ブラウザ情報を更新
                browser_info['contexts'].append(context)
                browser_info['last_used'] = datetime.now()
                browser_info['usage_count'] += 1
            
            yield page
            
        finally:
            # クリーンアップ
            if page:
                try:
                    await page.close()
                except Exception as e:
                    logger.error(f"ページのクローズに失敗: {e}")
            
            if context:
                try:
                    await context.close()
                except Exception as e:
                    logger.error(f"コンテキストのクローズに失敗: {e}")
            
            if browser_info and context in browser_info['contexts']:
                browser_info['contexts'].remove(context)
    
    async def cleanup_old_browsers(self, max_age_minutes: int = 30):
        """古いブラウザインスタンスをクリーンアップ"""
        async with self._lock:
            now = datetime.now()
            cutoff_time = now - timedelta(minutes=max_age_minutes)
            
            for browser_info in self.browsers[:]:
                if browser_info['created_at'] < cutoff_time and not browser_info['contexts']:
                    try:
                        await browser_info['browser'].close()
                        self.browsers.remove(browser_info)
                        
                        # 新しいブラウザを作成
                        new_browser = await self._create_browser()
                        self.browsers.append({
                            'browser': new_browser,
                            'contexts': [],
                            'created_at': now,
                            'last_used': now,
                            'usage_count': 0
                        })
                        logger.info("古いブラウザを新しいものに置き換えました")
                    except Exception as e:
                        logger.error(f"ブラウザのクリーンアップに失敗: {e}")
    
    async def shutdown(self):
        """ブラウザプールをシャットダウン"""
        if not self._initialized:
            return
        
        logger.info("ブラウザプールをシャットダウン中...")
        
        for browser_info in self.browsers:
            try:
                # すべてのコンテキストを閉じる
                for context in browser_info['contexts']:
                    await context.close()
                
                # ブラウザを閉じる
                await browser_info['browser'].close()
            except Exception as e:
                logger.error(f"ブラウザのクローズに失敗: {e}")
        
        if self.playwright:
            await self.playwright.stop()
        
        self.browsers.clear()
        self._initialized = False
        logger.info("ブラウザプールのシャットダウンが完了しました")
    
    def get_stats(self) -> Dict[str, Any]:
        """プールの統計情報を取得"""
        if not self._initialized:
            return {'status': 'not_initialized'}
        
        total_contexts = sum(len(b['contexts']) for b in self.browsers)
        total_usage = sum(b['usage_count'] for b in self.browsers)
        
        return {
            'status': 'active',
            'pool_size': self.pool_size,
            'active_browsers': len(self.browsers),
            'total_contexts': total_contexts,
            'total_usage': total_usage,
            'browsers': [
                {
                    'contexts': len(b['contexts']),
                    'created_at': b['created_at'].isoformat(),
                    'last_used': b['last_used'].isoformat(),
                    'usage_count': b['usage_count']
                }
                for b in self.browsers
            ]
        }


# グローバルインスタンス
browser_pool = BrowserPoolManager()