#!/usr/bin/env python3
"""
Celery Beat（スケジューラー）起動スクリプト
"""
import os
import sys

# プロジェクトルートをPythonパスに追加
sys.path.insert(0, os.path.dirname(__file__))

from app.core.celery_app import celery_app

if __name__ == "__main__":
    # Celery Beatを起動
    # 使用例: python celery_beat.py
    celery_app.start(
        argv=[
            "beat",
            "--loglevel=info",
            "--scheduler=celery.beat:PersistentScheduler"
        ]
    ) 