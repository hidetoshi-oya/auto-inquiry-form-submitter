FROM node:20-alpine

WORKDIR /app

# 非rootユーザーを作成（早期作成でセキュリティ向上）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# package.jsonとpackage-lock.json（存在する場合）をコピー
COPY package*.json ./

# キャッシュマウントを使用して依存関係をインストール
# NODE_ENVを明示的に開発モードに設定してdevDependenciesを確実にインストール
ENV NODE_ENV=development
RUN npm install

# アプリケーションコードをコピー
COPY . .

# ディレクトリの所有権を変更
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 5173

# Viteの開発サーバーをホスト0.0.0.0でバインド
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]