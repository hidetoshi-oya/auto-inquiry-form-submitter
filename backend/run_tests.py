#!/usr/bin/env python3
"""
包括的なテスト実行スクリプト
"""
import os
import sys
import subprocess
from pathlib import Path


def run_command(command, description):
    """コマンドを実行し、結果を返す"""
    print(f"\n{'='*60}")
    print(f"🔍 {description}")
    print(f"{'='*60}")
    print(f"実行コマンド: {command}")
    print("-" * 60)
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=False,
            text=True,
            cwd=Path(__file__).parent
        )
        
        if result.returncode == 0:
            print(f"\n✅ {description} - 成功")
            return True
        else:
            print(f"\n❌ {description} - 失敗 (終了コード: {result.returncode})")
            return False
            
    except Exception as e:
        print(f"\n❌ {description} - エラー: {e}")
        return False


def check_dependencies():
    """必要な依存関係をチェック"""
    print("📦 依存関係の確認中...")
    
    try:
        import pytest
        import httpx
        import sqlalchemy
        import fastapi
        print("✅ 主要な依存関係は正常にインストールされています")
        return True
    except ImportError as e:
        print(f"❌ 依存関係が不足しています: {e}")
        print("💡 pip install -r requirements.txt を実行してください")
        return False


def main():
    """メインの実行関数"""
    print("🧪 Auto Inquiry Form Submitter - テスト実行")
    print("=" * 60)
    
    # 依存関係チェック
    if not check_dependencies():
        sys.exit(1)
    
    # 環境変数設定
    os.environ.setdefault("TESTING", "true")
    os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
    os.environ.setdefault("S3_ENDPOINT_URL", "http://localhost:9000")
    os.environ.setdefault("S3_ACCESS_KEY", "test")
    os.environ.setdefault("S3_SECRET_KEY", "test")
    os.environ.setdefault("S3_BUCKET_NAME", "test")
    os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/2")
    os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/3")
    
    tests_passed = 0
    total_tests = 0
    
    # テストケースのリスト
    test_cases = [
        ("pytest tests/test_auth.py -v", "認証機能のテスト"),
        ("pytest tests/test_companies.py -v", "企業管理機能のテスト"),
        ("pytest tests/test_templates.py -v", "テンプレート管理機能のテスト"),
    ]
    
    # 各テストを実行
    for command, description in test_cases:
        total_tests += 1
        if run_command(command, description):
            tests_passed += 1
    
    # カバレッジレポート生成
    if tests_passed > 0:
        total_tests += 1
        if run_command("pytest --cov=app --cov-report=html --cov-report=term", "カバレッジレポート生成"):
            tests_passed += 1
            print("\n📊 HTMLカバレッジレポートが htmlcov/ ディレクトリに生成されました")
    
    # 結果サマリー
    print(f"\n{'='*60}")
    print("📊 テスト結果サマリー")
    print(f"{'='*60}")
    print(f"実行テスト数: {total_tests}")
    print(f"成功: {tests_passed}")
    print(f"失敗: {total_tests - tests_passed}")
    print(f"成功率: {(tests_passed/total_tests)*100:.1f}%")
    
    if tests_passed == total_tests:
        print("\n🎉 すべてのテストが成功しました！")
        return 0
    else:
        print(f"\n⚠️  {total_tests - tests_passed}個のテストが失敗しました")
        return 1


if __name__ == "__main__":
    sys.exit(main())