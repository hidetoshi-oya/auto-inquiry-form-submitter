#!/bin/bash
set -e

# テスト用Docker環境でのテスト実行スクリプト

echo "🐳 Docker環境でのテスト実行を開始..."

# 色付きメッセージ関数
info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# エラー時のクリーンアップ
cleanup() {
    info "テスト環境をクリーンアップ中..."
    docker compose -f ../docker-compose.test.yml down -v --remove-orphans
}

# トラップでクリーンアップを設定
trap cleanup EXIT

# テスト用データベースの起動
info "テスト用データベースを起動中..."
docker compose -f ../docker-compose.test.yml up -d

# データベースの健全性チェック
info "データベースの起動を待機中..."
timeout=60
counter=0

while ! docker compose -f ../docker-compose.test.yml exec -T test-db pg_isready -U test_user -d test_auto_inquiry_db; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        error "データベースの起動がタイムアウトしました"
        exit 1
    fi
    echo "データベース起動待機中... ($counter/${timeout}秒)"
done

success "データベースが正常に起動しました"

# Redisの健全性チェック
info "Redisの起動を待機中..."
timeout=30
counter=0

while ! docker compose -f ../docker-compose.test.yml exec -T test-redis redis-cli ping | grep -q "PONG"; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        error "Redisの起動がタイムアウトしました"
        exit 1
    fi
    echo "Redis起動待機中... ($counter/${timeout}秒)"
done

success "Redisが正常に起動しました"

# 環境変数の設定
export DATABASE_URL="postgresql://test_user:test_password@localhost:5434/test_auto_inquiry_db"
export REDIS_URL="redis://localhost:6380/0"
export CELERY_BROKER_URL="redis://localhost:6380/1"
export CELERY_RESULT_BACKEND="redis://localhost:6380/2"
export TESTING="1"
export ENVIRONMENT="test"
export SECRET_KEY="test_secret_key_for_testing_only"

info "環境変数を設定しました:"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  REDIS_URL: $REDIS_URL"
echo "  TESTING: $TESTING"

# テストの実行
info "テストを実行中..."

# 引数があれば特定のテストを実行、なければ全テスト実行
if [ $# -eq 0 ]; then
    info "全てのテストを実行します..."
    PYTHONPATH=. uv run pytest tests/ -v --tb=short --cov=app --cov-report=term-missing
else
    info "指定されたテストを実行します: $*"
    PYTHONPATH=. uv run pytest "$@" -v --tb=short
fi

# テスト結果の確認
if [ $? -eq 0 ]; then
    success "🎉 全てのテストが正常に完了しました！"
else
    error "❌ テストが失敗しました"
    exit 1
fi 