"""
ブラウザプール機能のテスト
"""
import pytest
import asyncio
from app.services.browser_pool import browser_pool


class TestBrowserPool:
    """ブラウザプールのテストクラス"""
    
    @pytest.mark.asyncio
    async def test_browser_pool_initialization(self):
        """ブラウザプールの初期化テスト"""
        await browser_pool.initialize()
        stats = browser_pool.get_stats()
        
        assert stats["status"] == "active"
        assert stats["pool_size"] == 10
        assert stats["active_browsers"] == 10
        
        # クリーンアップ
        await browser_pool.shutdown()
    
    @pytest.mark.asyncio
    async def test_browser_pool_page_context(self):
        """ブラウザプールのページコンテキストテスト"""
        await browser_pool.initialize()
        
        async with browser_pool.get_page() as page:
            assert page is not None
            # 基本的なページ操作をテスト
            await page.goto("data:text/html,<h1>Test</h1>")
            title = await page.title()
            assert title == ""  # data URLの場合タイトルは空
        
        # クリーンアップ
        await browser_pool.shutdown()
    
    @pytest.mark.asyncio
    async def test_browser_pool_multiple_pages(self):
        """複数ページの同時使用テスト"""
        await browser_pool.initialize()
        
        async def use_page(page_id):
            async with browser_pool.get_page() as page:
                await page.goto(f"data:text/html,<h1>Page {page_id}</h1>")
                content = await page.content()
                assert f"Page {page_id}" in content
                return page_id
        
        # 複数ページを同時に使用
        tasks = [use_page(i) for i in range(3)]
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 3
        assert sorted(results) == [0, 1, 2]
        
        # クリーンアップ
        await browser_pool.shutdown()
    
    def test_browser_pool_stats_before_init(self):
        """初期化前の統計情報テスト"""
        stats = browser_pool.get_stats()
        assert stats["status"] == "not_initialized" 