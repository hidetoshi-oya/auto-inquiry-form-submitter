#!/usr/bin/env python3
"""
APIの動作確認用スクリプト
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """ヘルスチェック"""
    print("=== Health Check ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_auth():
    """認証テスト"""
    print("=== Authentication Test ===")
    
    # ユーザー登録
    print("1. Register new user")
    register_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "is_active": True,
        "is_superuser": False
    }
    response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    print()
    
    # ログイン
    print("2. Login")
    login_data = {
        "username": "testuser",
        "password": "testpassword123"
    }
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        token_data = response.json()
        print(f"Response: {token_data}")
        access_token = token_data["access_token"]
        
        # 現在のユーザー情報取得
        print("\n3. Get current user")
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        return access_token
    else:
        print(f"Error: {response.text}")
        return None

def test_companies(token):
    """企業管理APIテスト"""
    if not token:
        print("=== Skipping Companies Test (No token) ===")
        return
    
    print("\n=== Companies API Test ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 企業追加
    print("1. Create company")
    company_data = {
        "name": "テスト株式会社",
        "url": "https://example.com",
        "status": "active",
        "meta_data": {},
        "memo": "テスト用企業"
    }
    response = requests.post(f"{BASE_URL}/api/companies", json=company_data, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        company = response.json()
        print(f"Response: {company}")
        company_id = company["id"]
        
        # 企業一覧取得
        print("\n2. Get companies list")
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # 企業詳細取得
        print(f"\n3. Get company detail (ID: {company_id})")
        response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")

def main():
    """メイン処理"""
    print("API Test Script")
    print("=" * 50)
    
    # ヘルスチェック
    test_health()
    
    # 認証テスト
    token = test_auth()
    
    # 企業管理APIテスト
    test_companies(token)
    
    print("\n" + "=" * 50)
    print("Test completed!")

if __name__ == "__main__":
    main()