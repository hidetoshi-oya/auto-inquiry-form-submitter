#!/usr/bin/env python3
"""
テストユーザーアカウント作成スクリプト

このスクリプトは開発・テスト用のユーザーアカウントを作成します。
"""

import sys
import asyncio
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app.models.user import User
from app.core import security

def create_test_user():
    """テストユーザーを作成"""
    
    # テストユーザーの情報
    test_user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpass123",
        "is_active": True,
        "is_superuser": False
    }
    
    print("=== テストユーザー作成スクリプト ===")
    print(f"ユーザー名: {test_user_data['username']}")
    print(f"メールアドレス: {test_user_data['email']}")
    print(f"パスワード: {test_user_data['password']}")
    
    try:
        # データベース接続
        db = next(get_db())
        
        # 既存ユーザーの確認
        existing_user = db.query(User).filter(
            (User.email == test_user_data["email"]) | 
            (User.username == test_user_data["username"])
        ).first()
        
        if existing_user:
            print(f"⚠️  ユーザーが既に存在します: {existing_user.username} ({existing_user.email})")
            print("既存のユーザーでログインテストを行うことができます。")
            return
        
        # パスワードをハッシュ化
        hashed_password = security.get_password_hash(test_user_data["password"])
        
        # ユーザーを作成
        db_user = User(
            email=test_user_data["email"],
            username=test_user_data["username"],
            hashed_password=hashed_password,
            is_active=test_user_data["is_active"],
            is_superuser=test_user_data["is_superuser"]
        )
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        print("✅ テストユーザーが正常に作成されました！")
        print(f"   ID: {db_user.id}")
        print(f"   作成日時: {db_user.created_at}")
        print()
        print("=== ログイン情報 ===")
        print(f"ユーザー名: {test_user_data['username']}")
        print(f"パスワード: {test_user_data['password']}")
        print()
        print("このアカウントでフロントエンドからログインできます。")
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()