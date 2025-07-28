import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.company import Company


@pytest.mark.unit
@pytest.mark.db
def test_create_company(authenticated_client: TestClient, sample_company_data):
    """企業作成のテスト"""
    company_data = sample_company_data()
    
    response = authenticated_client.post("/api/companies/", json=company_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == company_data["name"]
    # PydanticがURLを正規化して末尾にスラッシュを追加するため調整
    assert data["url"].rstrip('/') == company_data["url"].rstrip('/')
    assert data["memo"] == company_data["memo"]
    assert data["status"] == company_data["status"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.unit
@pytest.mark.db
def test_create_company_duplicate_url(authenticated_client: TestClient, sample_company_data):
    """重複URLでの企業作成エラーテスト"""
    company_data = sample_company_data()
    
    # 最初の企業作成
    authenticated_client.post("/api/companies/", json=company_data)
    
    # 同じURLで再作成
    duplicate_data = sample_company_data(name="別の会社", url=company_data["url"])
    response = authenticated_client.post("/api/companies/", json=duplicate_data)
    
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.unit
@pytest.mark.auth
def test_create_company_no_auth(unauthenticated_client: TestClient, sample_company_data):
    """認証なしでの企業作成エラーテスト"""
    company_data = sample_company_data()
    
    response = unauthenticated_client.post("/api/companies/", json=company_data)
    
    assert response.status_code == 401


@pytest.mark.unit
@pytest.mark.db
def test_get_companies(authenticated_client: TestClient, sample_company_data):
    """企業一覧取得のテスト"""
    # テスト用企業を複数作成
    companies_data = [
        sample_company_data(name="テスト企業1", url="https://example1.com"),
        sample_company_data(name="テスト企業2", url="https://example2.com"),
        sample_company_data(name="テスト企業3", url="https://example3.com")
    ]
    
    created_companies = []
    for company_data in companies_data:
        response = authenticated_client.post("/api/companies/", json=company_data)
        assert response.status_code == 200
        created_companies.append(response.json())
    
    # 企業一覧取得
    response = authenticated_client.get("/api/companies/")
    assert response.status_code == 200
    
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "size" in data
    assert "pages" in data
    
    assert len(data["items"]) >= len(companies_data)
    assert data["total"] >= len(companies_data)


@pytest.mark.unit
@pytest.mark.db
def test_get_companies_pagination(authenticated_client: TestClient, sample_company_data):
    """企業一覧のページネーションテスト"""
    # 5つの企業を作成
    for i in range(5):
        company_data = sample_company_data(
            name=f"テスト企業{i+1}",
            url=f"https://example{i+1}.com"
        )
        response = authenticated_client.post("/api/companies/", json=company_data)
        assert response.status_code == 200
    
    # ページネーションテスト（1ページ目、サイズ2）
    response = authenticated_client.get("/api/companies/?page=1&size=2")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["size"] == 2
    assert data["total"] >= 5
    
    # 2ページ目をテスト
    response = authenticated_client.get("/api/companies/?page=2&size=2")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data["items"]) >= 1
    assert data["page"] == 2


@pytest.mark.unit
@pytest.mark.db
def test_get_companies_search(authenticated_client: TestClient, sample_company_data):
    """企業検索のテスト"""
    # 特定の名前で企業を作成
    search_company = sample_company_data(
        name="検索対象企業",
        url="https://search-target.com"
    )
    other_company = sample_company_data(
        name="その他の企業",
        url="https://other.com"
    )
    
    authenticated_client.post("/api/companies/", json=search_company)
    authenticated_client.post("/api/companies/", json=other_company)
    
    # 名前による検索
    response = authenticated_client.get("/api/companies/?search=検索対象")
    assert response.status_code == 200
    
    data = response.json()
    assert data["total"] >= 1
    found_names = [item["name"] for item in data["items"]]
    assert any("検索対象" in name for name in found_names)


@pytest.mark.unit
@pytest.mark.db
def test_get_company_detail(authenticated_client: TestClient, sample_company_data):
    """企業詳細取得のテスト"""
    company_data = sample_company_data()
    
    # 企業作成
    create_response = authenticated_client.post("/api/companies/", json=company_data)
    created_company = create_response.json()
    company_id = created_company["id"]
    
    # 企業詳細取得
    response = authenticated_client.get(f"/api/companies/{company_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == company_id
    assert data["name"] == company_data["name"]
    assert data["url"] == company_data["url"]


@pytest.mark.unit
@pytest.mark.db
def test_get_company_detail_not_found(authenticated_client: TestClient):
    """存在しない企業の詳細取得エラーテスト"""
    response = authenticated_client.get("/api/companies/999999")
    assert response.status_code == 404


@pytest.mark.unit
@pytest.mark.db
def test_update_company(authenticated_client: TestClient, sample_company_data):
    """企業情報更新のテスト"""
    company_data = sample_company_data()
    
    # 企業作成
    create_response = authenticated_client.post("/api/companies/", json=company_data)
    created_company = create_response.json()
    company_id = created_company["id"]
    
    # 更新データ
    update_data = {
        "name": "更新後企業名",
        "description": "更新後の説明",
        "industry": "Finance"
    }
    
    # 企業更新
    response = authenticated_client.put(f"/api/companies/{company_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["description"] == update_data["description"]
    assert data["industry"] == update_data["industry"]
    assert data["url"] == company_data["url"]  # URLは変更されていない


@pytest.mark.unit
@pytest.mark.db
def test_update_company_not_found(authenticated_client: TestClient):
    """存在しない企業の更新エラーテスト"""
    update_data = {"name": "更新後企業名"}
    
    response = authenticated_client.put("/api/companies/999999", json=update_data)
    assert response.status_code == 404


@pytest.mark.unit
@pytest.mark.db 
def test_update_company_partial(authenticated_client: TestClient, sample_company_data):
    """企業情報の部分更新テスト"""
    company_data = sample_company_data()
    
    # 企業作成
    create_response = authenticated_client.post("/api/companies/", json=company_data)
    created_company = create_response.json()
    company_id = created_company["id"]
    
    # 名前のみ更新
    update_data = {"name": "部分更新後企業名"}
    
    response = authenticated_client.put(f"/api/companies/{company_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["url"] == company_data["url"]  # 他のフィールドは変更されていない
    assert data["description"] == company_data["description"]


@pytest.mark.unit
@pytest.mark.db
def test_delete_company(authenticated_client: TestClient, sample_company_data):
    """企業削除のテスト"""
    company_data = sample_company_data()
    
    # 企業作成
    create_response = authenticated_client.post("/api/companies/", json=company_data)
    created_company = create_response.json()
    company_id = created_company["id"]
    
    # 企業削除
    response = authenticated_client.delete(f"/api/companies/{company_id}")
    assert response.status_code == 200
    
    # 削除確認
    get_response = authenticated_client.get(f"/api/companies/{company_id}")
    assert get_response.status_code == 404


@pytest.mark.unit
@pytest.mark.db
def test_delete_company_not_found(authenticated_client: TestClient):
    """存在しない企業の削除エラーテスト"""
    response = authenticated_client.delete("/api/companies/999999")
    assert response.status_code == 404


@pytest.mark.unit
@pytest.mark.auth
def test_companies_no_auth(unauthenticated_client: TestClient):
    """認証なしでの企業操作エラーテスト"""
    # 一覧取得
    response = unauthenticated_client.get("/api/companies/")
    assert response.status_code == 401
    
    # 詳細取得
    response = unauthenticated_client.get("/api/companies/1")
    assert response.status_code == 401
    
    # 更新
    response = unauthenticated_client.put("/api/companies/1", json={"name": "test"})
    assert response.status_code == 401
    
    # 削除
    response = unauthenticated_client.delete("/api/companies/1")
    assert response.status_code == 401


@pytest.mark.unit
@pytest.mark.db
def test_company_status_filter(authenticated_client: TestClient, sample_company_data):
    """企業ステータスフィルターのテスト"""
    # アクティブな企業
    active_company = sample_company_data(name="アクティブ企業", url="https://active.com")
    response = authenticated_client.post("/api/companies/", json=active_company)
    assert response.status_code == 200
    
    # 非アクティブな企業を作成（先にアクティブとして作成してから非アクティブに変更）
    inactive_company_data = sample_company_data(name="非アクティブ企業", url="https://inactive.com")
    create_response = authenticated_client.post("/api/companies/", json=inactive_company_data)
    inactive_company = create_response.json()
    
    # ステータスを非アクティブに更新
    update_response = authenticated_client.put(
        f"/api/companies/{inactive_company['id']}", 
        json={"status": "inactive"}
    )
    assert update_response.status_code == 200
    
    # アクティブな企業のみフィルタ
    response = authenticated_client.get("/api/companies/?status=active")
    assert response.status_code == 200
    
    data = response.json()
    active_companies = [item for item in data["items"] if item["status"] == "active"]
    assert len(active_companies) >= 1
    
    # 非アクティブな企業のみフィルタ
    response = authenticated_client.get("/api/companies/?status=inactive") 
    assert response.status_code == 200
    
    data = response.json()
    inactive_companies = [item for item in data["items"] if item["status"] == "inactive"]
    assert len(inactive_companies) >= 1


@pytest.mark.unit
@pytest.mark.db
def test_company_url_validation(authenticated_client: TestClient, sample_company_data):
    """企業URL検証のテスト"""
    # 無効なURL
    invalid_urls = [
        "not-a-url",
        "ftp://invalid.com",
        "http://",
        "",
        "javascript:alert('xss')"
    ]
    
    for invalid_url in invalid_urls:
        company_data = sample_company_data(url=invalid_url)
        response = authenticated_client.post("/api/companies/", json=company_data)
        assert response.status_code == 422  # Validation Error
    
    # 有効なURL
    valid_urls = [
        "https://example.com",
        "http://test.org", 
        "https://subdomain.example.com/path"
    ]
    
    for i, valid_url in enumerate(valid_urls):
        company_data = sample_company_data(
            name=f"Valid URL Company {i}",
            url=valid_url
        )
        response = authenticated_client.post("/api/companies/", json=company_data)
        assert response.status_code == 200


@pytest.mark.integration
@pytest.mark.db
def test_company_crud_integration(authenticated_client: TestClient, sample_company_data):
    """企業CRUD操作の統合テスト"""
    company_data = sample_company_data()
    
    # Create
    create_response = authenticated_client.post("/api/companies/", json=company_data)
    assert create_response.status_code == 200
    created_company = create_response.json()
    company_id = created_company["id"]
    
    # Read
    read_response = authenticated_client.get(f"/api/companies/{company_id}")
    assert read_response.status_code == 200
    read_company = read_response.json()
    assert read_company["name"] == company_data["name"]
    
    # Update
    update_data = {"name": "統合テスト更新企業"}
    update_response = authenticated_client.put(f"/api/companies/{company_id}", json=update_data)
    assert update_response.status_code == 200
    updated_company = update_response.json()
    assert updated_company["name"] == update_data["name"]
    
    # Delete
    delete_response = authenticated_client.delete(f"/api/companies/{company_id}")
    assert delete_response.status_code == 200
    
    # Verify deletion
    verify_response = authenticated_client.get(f"/api/companies/{company_id}")
    assert verify_response.status_code == 404