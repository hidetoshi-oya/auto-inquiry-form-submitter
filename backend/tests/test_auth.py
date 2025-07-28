import pytest
from fastapi.testclient import TestClient


def test_register_user(client: TestClient, test_user_data):
    """ユーザー登録のテスト"""
    response = client.post("/api/auth/register", json=test_user_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user_data["email"]
    assert data["username"] == test_user_data["username"]
    assert data["is_active"] == test_user_data["is_active"]
    assert "id" in data
    assert "password" not in data  # パスワードは返されない


def test_register_duplicate_email(client: TestClient, test_user_data):
    """重複メールアドレスでの登録エラーテスト"""
    # 最初の登録
    client.post("/api/auth/register", json=test_user_data)
    
    # 同じメールアドレスで再登録
    response = client.post("/api/auth/register", json=test_user_data)
    
    assert response.status_code == 400


def test_register_duplicate_username(client: TestClient, test_user_data):
    """重複ユーザー名での登録エラーテスト"""
    # 最初の登録
    client.post("/api/auth/register", json=test_user_data)
    
    # 同じユーザー名で異なるメールアドレス
    duplicate_data = test_user_data.copy()
    duplicate_data["email"] = "different@example.com"
    response = client.post("/api/auth/register", json=duplicate_data)
    
    assert response.status_code == 400


def test_login_success(client: TestClient, test_user_data):
    """ログイン成功のテスト"""
    # ユーザー登録
    client.post("/api/auth/register", json=test_user_data)
    
    # ログイン
    login_data = {
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    }
    response = client.post(
        "/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient, test_user_data):
    """パスワード間違いのログインエラーテスト"""
    # ユーザー登録
    client.post("/api/auth/register", json=test_user_data)
    
    # 間違ったパスワードでログイン
    login_data = {
        "username": test_user_data["username"],
        "password": "wrongpassword"
    }
    response = client.post(
        "/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    assert response.status_code == 400


def test_login_nonexistent_user(client: TestClient):
    """存在しないユーザーでのログインエラーテスト"""
    login_data = {
        "username": "nonexistent",
        "password": "password"
    }
    response = client.post(
        "/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    assert response.status_code == 400


def test_get_current_user(client: TestClient, auth_headers):
    """現在のユーザー情報取得のテスト"""
    response = client.get("/api/auth/me", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "username" in data
    assert "is_active" in data
    assert "password" not in data


def test_get_current_user_no_token(client: TestClient):
    """トークンなしでのユーザー情報取得エラーテスト"""
    response = client.get("/api/auth/me")
    
    assert response.status_code == 401


def test_get_current_user_invalid_token(client: TestClient):
    """無効なトークンでのユーザー情報取得エラーテスト"""
    headers = {"Authorization": "Bearer invalid_token"}
    response = client.get("/api/auth/me", headers=headers)
    
    assert response.status_code == 401


def test_refresh_token(client: TestClient, test_user_data):
    """リフレッシュトークンのテスト"""
    # ユーザー登録とログイン
    client.post("/api/auth/register", json=test_user_data)
    
    login_data = {
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    }
    login_response = client.post(
        "/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    tokens = login_response.json()
    refresh_token = tokens["refresh_token"]
    
    # リフレッシュトークンを使用して新しいアクセストークンを取得
    refresh_data = {"refresh_token": refresh_token}
    response = client.post("/api/auth/refresh", json=refresh_data)
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "token_type" in data


def test_logout(client: TestClient, auth_headers):
    """ログアウトのテスト"""
    response = client.post("/api/auth/logout", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["detail"] == "Successfully logged out"