# Celery セットアップと運用ガイド

## 🚀 システム概要

Auto Inquiry Form Submitterでは、Celery + Redis + Celery Beatを使用して以下の機能を提供しています：

- **フォーム検出の非同期処理**
- **バッチ送信とスケジューリング**
- **システムメンテナンスタスク**
- **自動レポート生成**

## 📋 前提条件

### 必要なサービス
1. **Redis** - メッセージブローカーとして使用
2. **PostgreSQL** - データベース
3. **Python 3.11+** - アプリケーション実行環境

### 依存関係
```bash
# 必要なパッケージは requirements.txt に含まれています
uv install
```

## ⚙️ 環境設定

### 1. 環境変数設定

```bash
# .env ファイルを作成
cp .env.example .env
```

重要な設定項目：
```env
# Redis（Celeryブローカー）
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/auto_inquiry_db

# その他の設定...
```

### 2. Redis起動

```bash
# Docker使用の場合
docker run -d -p 6379:6379 redis:alpine

# または brew（macOS）
brew install redis
brew services start redis
```

## 🚀 Celeryサービス起動

### 1. Celeryワーカー起動

```bash
# 基本起動
python celery_worker.py

# または uvを使用
uv run python celery_worker.py

# カスタム設定での起動
celery -A app.core.celery_app worker \
  --loglevel=info \
  --queues=default,forms,batch,schedule \
  --concurrency=4
```

### 2. Celery Beat（スケジューラー）起動

```bash
# 基本起動
python celery_beat.py

# または uvを使用
uv run python celery_beat.py

# カスタム設定での起動
celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler=celery.beat:PersistentScheduler
```

### 3. FastAPIアプリケーション起動

```bash
# 開発用
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📊 キューとタスク構成

### キュー構成
- **default** - 一般的なタスク
- **forms** - フォーム検出・送信タスク
- **batch** - バッチ処理タスク
- **schedule** - スケジュール管理タスク

### 主要タスク

#### フォーム関連
- `detect_forms_task` - フォーム検出
- `submit_form_task` - フォーム送信
- `browser_pool_maintenance` - ブラウザプール管理

#### バッチ処理
- `batch_submission` - バッチ送信メイン
- `batch_execution_task` - バッチ実行
- `retry_failed_submissions` - 失敗送信のリトライ

#### スケジュール・メンテナンス
- `check_scheduled_submissions` - スケジュール実行チェック
- `system_health_check` - システムヘルスチェック
- `cleanup_old_logs` - ログクリーンアップ
- `generate_daily_report` - 日次レポート生成

## 📈 モニタリング

### Celery Flower（WebUI）

```bash
# Flowerをインストール
uv add flower

# Flower起動
celery -A app.core.celery_app flower --port=5555
```

ブラウザで `http://localhost:5555` にアクセス

### ログ監視

```bash
# ワーカーログ
tail -f celery_worker.log

# Beatログ
tail -f celery_beat.log
```

## 🔧 運用コマンド

### タスク状態確認

```python
from app.core.celery_app import celery_app

# アクティブなタスク確認
i = celery_app.control.inspect()
print(i.active())

# 統計情報
print(i.stats())
```

### 手動タスク実行

```python
from app.tasks.form_tasks import detect_forms_task
from app.tasks.batch_tasks import batch_submission

# フォーム検出を手動実行
result = detect_forms_task.apply_async(args=[company_id, False])

# バッチ送信を手動実行
result = batch_submission.apply_async(
    args=[company_ids, template_id, 30, False, True]
)
```

## 🐛 トラブルシューティング

### よくある問題

1. **Redis接続エラー**
   ```bash
   # Redis起動状態確認
   redis-cli ping
   # PONG が返ればOK
   ```

2. **タスクが実行されない**
   ```bash
   # ワーカーが起動しているか確認
   celery -A app.core.celery_app inspect active
   
   # キューの状態確認
   celery -A app.core.celery_app inspect reserved
   ```

3. **メモリ不足**
   ```bash
   # ワーカーの同時実行数を調整
   celery -A app.core.celery_app worker --concurrency=2
   ```

### ログレベル調整

```bash
# デバッグモード
celery -A app.core.celery_app worker --loglevel=debug

# エラーのみ
celery -A app.core.celery_app worker --loglevel=error
```

## 🔄 スケール構成例

### 開発環境
```bash
# 1つのワーカーで全キューを処理
celery -A app.core.celery_app worker --loglevel=info --concurrency=2
```

### 本番環境
```bash
# フォーム専用ワーカー
celery -A app.core.celery_app worker --queues=forms --concurrency=4

# バッチ専用ワーカー
celery -A app.core.celery_app worker --queues=batch --concurrency=2

# スケジュール専用ワーカー
celery -A app.core.celery_app worker --queues=schedule --concurrency=1

# Beat（スケジューラー）
celery -A app.core.celery_app beat
```

## 📋 チェックリスト

起動前の確認項目：
- [ ] Redis が起動している
- [ ] PostgreSQL が起動している
- [ ] 環境変数が正しく設定されている
- [ ] Playwright がインストールされている
- [ ] 必要なディレクトリ（screenshots など）が存在する

## 🔗 関連リンク

- [Celery公式ドキュメント](https://docs.celeryq.dev/)
- [Redis公式ドキュメント](https://redis.io/documentation)
- [Flower監視ツール](https://flower.readthedocs.io/) 