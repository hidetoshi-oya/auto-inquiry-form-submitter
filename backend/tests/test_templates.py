import pytest
from fastapi.testclient import TestClient


def test_create_template(client: TestClient, auth_headers, test_template_data):
    """テンプレート作成のテスト"""
    response = client.post("/api/templates", json=test_template_data, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == test_template_data["name"]
    assert data["category"] == test_template_data["category"]
    assert len(data["fields"]) == len(test_template_data["fields"])
    assert len(data["variables"]) == len(test_template_data["variables"])
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_template_no_auth(client: TestClient, test_template_data):
    """認証なしでのテンプレート作成エラーテスト"""
    response = client.post("/api/templates", json=test_template_data)
    
    assert response.status_code == 401


def test_get_templates(client: TestClient, auth_headers, test_template_data):
    """テンプレート一覧取得のテスト"""
    # テスト用テンプレートを複数作成
    templates_data = [
        test_template_data,
        {
            "name": "お問い合わせテンプレート",
            "category": "inquiry",
            "fields": [
                {
                    "field_name": "subject",
                    "field_type": "text",
                    "content": "お問い合わせ件名",
                    "required": True
                }
            ],
            "variables": []
        },
        {
            "name": "パートナー向けテンプレート",
            "category": "partnership",
            "fields": [
                {
                    "field_name": "company_name",
                    "field_type": "text",
                    "content": "{{company_name}}",
                    "required": True
                }
            ],
            "variables": [
                {
                    "name": "company_name",
                    "description": "企業名",
                    "default_value": "サンプル企業"
                }
            ]
        }
    ]
    
    for template_data in templates_data:
        client.post("/api/templates", json=template_data, headers=auth_headers)
    
    # テンプレート一覧取得
    response = client.get("/api/templates", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all("id" in template for template in data)
    assert all("name" in template for template in data)


def test_get_templates_by_category(client: TestClient, auth_headers, test_template_data):
    """カテゴリ別テンプレート取得のテスト"""
    # 異なるカテゴリのテンプレートを作成
    sales_template = test_template_data.copy()
    sales_template["category"] = "sales"
    
    inquiry_template = test_template_data.copy()
    inquiry_template["name"] = "お問い合わせテンプレート"
    inquiry_template["category"] = "inquiry"
    
    client.post("/api/templates", json=sales_template, headers=auth_headers)
    client.post("/api/templates", json=inquiry_template, headers=auth_headers)
    
    # salesカテゴリのテンプレート取得
    response = client.get("/api/templates?category=sales", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["category"] == "sales"


def test_get_template_detail(client: TestClient, auth_headers, test_template_data):
    """テンプレート詳細取得のテスト"""
    # テンプレート作成
    create_response = client.post("/api/templates", json=test_template_data, headers=auth_headers)
    template = create_response.json()
    template_id = template["id"]
    
    # テンプレート詳細取得
    response = client.get(f"/api/templates/{template_id}", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == template_id
    assert data["name"] == test_template_data["name"]
    assert data["category"] == test_template_data["category"]
    assert len(data["fields"]) == len(test_template_data["fields"])


def test_get_template_detail_not_found(client: TestClient, auth_headers):
    """存在しないテンプレートの詳細取得エラーテスト"""
    response = client.get("/api/templates/9999", headers=auth_headers)
    
    assert response.status_code == 404
    assert "Template not found" in response.json()["detail"]


def test_update_template(client: TestClient, auth_headers, test_template_data):
    """テンプレート更新のテスト"""
    # テンプレート作成
    create_response = client.post("/api/templates", json=test_template_data, headers=auth_headers)
    template = create_response.json()
    template_id = template["id"]
    
    # 更新データ
    update_data = {
        "name": "更新された営業用テンプレート",
        "category": "updated_sales",
        "fields": [
            {
                "field_name": "updated_field",
                "field_type": "text",
                "content": "更新されたフィールド",
                "required": False
            }
        ],
        "variables": []
    }
    
    # テンプレート更新
    response = client.put(f"/api/templates/{template_id}", json=update_data, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["category"] == update_data["category"]
    assert len(data["fields"]) == len(update_data["fields"])
    assert data["fields"][0]["field_name"] == "updated_field"


def test_update_template_not_found(client: TestClient, auth_headers):
    """存在しないテンプレートの更新エラーテスト"""
    update_data = {"name": "更新名"}
    response = client.put("/api/templates/9999", json=update_data, headers=auth_headers)
    
    assert response.status_code == 404
    assert "Template not found" in response.json()["detail"]


def test_delete_template(client: TestClient, auth_headers, test_template_data):
    """テンプレート削除のテスト"""
    # テンプレート作成
    create_response = client.post("/api/templates", json=test_template_data, headers=auth_headers)
    template = create_response.json()
    template_id = template["id"]
    
    # テンプレート削除
    response = client.delete(f"/api/templates/{template_id}", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == template_id
    
    # 削除後に取得しようとするとエラー
    get_response = client.get(f"/api/templates/{template_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_delete_template_not_found(client: TestClient, auth_headers):
    """存在しないテンプレートの削除エラーテスト"""
    response = client.delete("/api/templates/9999", headers=auth_headers)
    
    assert response.status_code == 404
    assert "Template not found" in response.json()["detail"]


def test_templates_no_auth(client: TestClient):
    """認証なしでのテンプレート操作エラーテスト"""
    # 一覧取得
    response = client.get("/api/templates")
    assert response.status_code == 401
    
    # 詳細取得
    response = client.get("/api/templates/1")
    assert response.status_code == 401
    
    # 更新
    response = client.put("/api/templates/1", json={"name": "test"})
    assert response.status_code == 401
    
    # 削除
    response = client.delete("/api/templates/1")
    assert response.status_code == 401


def test_template_variable_processing(client: TestClient, auth_headers):
    """テンプレート変数処理のテスト"""
    template_data = {
        "name": "変数テストテンプレート",
        "category": "test",
        "fields": [
            {
                "field_name": "message",
                "field_type": "textarea",
                "content": "{{company_name}}様、{{date}}にご連絡いたします。",
                "required": True
            }
        ],
        "variables": [
            {
                "name": "company_name",
                "description": "企業名",
                "default_value": "サンプル企業"
            },
            {
                "name": "date",
                "description": "日付",
                "default_value": "2024-01-01"
            }
        ]
    }
    
    # テンプレート作成
    response = client.post("/api/templates", json=template_data, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["variables"]) == 2
    assert any(var["name"] == "company_name" for var in data["variables"])
    assert any(var["name"] == "date" for var in data["variables"])


def test_template_preview(client: TestClient, auth_headers, test_template_data):
    """テンプレートプレビュー機能のテスト"""
    # テンプレート作成
    create_response = client.post("/api/templates", json=test_template_data, headers=auth_headers)
    template = create_response.json()
    template_id = template["id"]
    
    # プレビュー用変数データ
    preview_data = {
        "company_name": "プレビュー株式会社"
    }
    
    # プレビュー取得
    response = client.post(f"/api/templates/{template_id}/preview", json=preview_data, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert "fields" in data
    
    # 変数が置換されているかチェック
    message_field = next((field for field in data["fields"] if field["field_name"] == "message"), None)
    assert message_field is not None
    assert "プレビュー株式会社" in message_field["content"]