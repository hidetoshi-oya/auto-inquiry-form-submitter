# Auto Inquiry Form Submitter

企業のウェブサイトから問い合わせフォームを自動的に検出し、必要な情報を入力して送信することで、複数企業への問い合わせ業務を効率化するWebサービス。

## 技術スタック

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- Vite

### Backend  
- FastAPI (Python 3.11+)
- PostgreSQL 15
- Redis 7
- Playwright (Chromium)
- Celery
- uv (パッケージマネージャー)

### Infrastructure
- Docker + Docker Compose
- MinIO (S3互換ストレージ)

## プロジェクト構造

```
.
├── backend/                # バックエンドAPI (FastAPI)
│   ├── app/
│   │   ├── api/           # APIエンドポイント
│   │   ├── core/          # コア設定、セキュリティ
│   │   ├── models/        # SQLAlchemyモデル
│   │   ├── services/      # ビジネスロジック
│   │   └── utils/         # ユーティリティ
│   ├── alembic/           # データベースマイグレーション
│   └── tests/             # テスト
├── frontend/              # フロントエンド (React)
│   ├── src/
│   │   ├── components/    # UIコンポーネント
│   │   ├── pages/         # ページコンポーネント
│   │   ├── services/      # API通信
│   │   ├── types/         # TypeScript型定義
│   │   ├── hooks/         # カスタムフック
│   │   └── utils/         # ユーティリティ
│   └── public/            # 静的ファイル
└── docker-compose.yml     # Docker設定

```

## セットアップ

### 前提条件
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- uv (Pythonパッケージマネージャー)

### uvのインストール

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# または Homebrew を使用
brew install uv
```

### 開発環境の起動

```bash
# 全サービスの起動（PostgreSQL, Redis, MinIO, Backend, Frontend）
docker-compose up -d

# ログの確認
docker-compose logs -f

# 特定のサービスのログ確認
docker-compose logs -f backend
docker-compose logs -f frontend
```

**アクセス先:**
- **フロントエンド**: http://localhost:5173
- **バックエンドAPI**: http://localhost:8000
- **MinIOコンソール**: http://localhost:9001 (admin/minioadmin)

**サービス管理:**
```bash
# サービス停止
docker-compose down

# データを含めて完全削除
docker-compose down -v

# 特定のサービスだけ再起動
docker-compose restart backend
docker-compose restart frontend
```

### APIドキュメント

開発サーバー起動後、以下のURLでAPIドキュメントを確認できます：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 主な機能

1. **企業URL管理** - 問い合わせ対象企業のURL管理
2. **フォーム自動検出** - Webサイトから問い合わせフォームを自動検出
3. **テンプレート管理** - 問い合わせ内容のテンプレート作成・管理
4. **自動送信** - フォームへの自動入力と送信
5. **送信履歴管理** - 送信結果の記録と管理
6. **バッチ処理** - 複数企業への一括送信
7. **セキュリティ** - robots.txt遵守、レート制限等

## APIエンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - 現在のユーザー情報取得

### 企業管理
- `GET /api/companies` - 企業一覧取得
- `POST /api/companies` - 企業追加
- `GET /api/companies/{id}` - 企業詳細取得
- `PUT /api/companies/{id}` - 企業情報更新
- `DELETE /api/companies/{id}` - 企業削除

### テンプレート管理
- `GET /api/templates` - テンプレート一覧取得
- `POST /api/templates` - テンプレート作成
- `GET /api/templates/{id}` - テンプレート詳細取得
- `PUT /api/templates/{id}` - テンプレート更新
- `DELETE /api/templates/{id}` - テンプレート削除

### フォーム検出
- `POST /api/forms/detect` - フォーム検出実行
- `GET /api/forms/company/{company_id}` - 企業のフォーム一覧取得

### 送信管理
- `POST /api/submissions/single` - 単一送信
- `POST /api/submissions/batch` - バッチ送信
- `GET /api/submissions/history` - 送信履歴取得

### スケジュール管理
- `GET /api/schedules` - スケジュール一覧取得
- `POST /api/schedules` - スケジュール作成
- `PUT /api/schedules/{id}` - スケジュール更新
- `DELETE /api/schedules/{id}` - スケジュール削除

## 実装状況

- ✅ 基本的なプロジェクト構造
- ✅ データベースモデル（SQLAlchemy）
- ✅ 認証システム（JWT）
- ✅ APIエンドポイント（完全実装）
- ✅ フォーム検出エンジン（Playwright）
- ✅ 自動送信機能
- ✅ バッチ処理（Celery）
- ✅ フロントエンド実装
- ✅ セキュリティ・コンプライアンス機能
- ✅ E2Eテスト（Playwright Test）
- ✅ CI/CDパイプライン（GitHub Actions）
- ✅ Kubernetes デプロイメント設定

## デプロイメント

### Docker Compose（開発・ステージング）

```bash
# Production用Docker Composeでの起動
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes（本番環境）

```bash
# Kubernetesへのデプロイ
./k8s/deploy.sh production
```

詳細は以下のドキュメントを参照：
- [Kubernetes デプロイメントガイド](./k8s/README.md)
- [GitHub Actions CI/CD](/.github/workflows/README.md)

## テスト

```bash
# バックエンドテスト
cd backend
uv run pytest

# フロントエンドテスト
cd frontend
npm test

# E2Eテスト
npm run test:e2e
```

## セキュリティ

- JWT認証
- CSRF保護
- XSS対策
- レート制限
- robots.txt遵守
- 利用規約チェック

## 開発者向け情報

### Pythonパッケージ管理

このプロジェクトはPythonパッケージマネージャーとして `uv` を使用しています。

```bash
# 新しいパッケージの追加
uv add package-name

# 開発用パッケージの追加
uv add --dev package-name

# パッケージの削除
uv remove package-name

# ロックファイルの更新
uv sync
```

依存関係は `pyproject.toml` で管理され、正確なバージョンは `uv.lock` にロックされています。

### コード品質チェック

```bash
# バックエンドのコード品質チェック
cd backend
# フォーマット
uv run ruff format .
# リント
uv run ruff check . --fix
# 型チェック
uv run pyright
```

テストアカウント:
- ユーザー名: testuser
- パスワード: testpass123
- メール: test@example.com