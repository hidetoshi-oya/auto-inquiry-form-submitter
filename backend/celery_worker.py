#!/usr/bin/env python3
"""
Celeryワーカー起動スクリプト
"""
import os
import sys

# プロジェクトルートをPythonパスに追加
sys.path.insert(0, os.path.dirname(__file__))

from app.core.celery_app import celery_app

if __name__ == "__main__":
    # Celeryワーカーを起動
    # 使用例: python celery_worker.py
    celery_app.start(
        argv=[
            "worker",
            "--loglevel=info",
            "--pool=solo",  # Windowsでの互換性のため
            "--queues=default,forms,batch,schedule",
            "--concurrency=4"
        ]
    ) 