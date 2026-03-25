.PHONY: db db-stop dev dev-bg dev-stop build test clean \
       auth-dev feed-dev ai-dev notification-dev web-dev \
       auth-test feed-test ai-test notification-test web-test cli-test \
       migrate lint typecheck \
       seed-test test-integration setup \
       deploy deploy-diff destroy

# ─── 環境変数の自動読み込み ──────────────────────────────
# .env.test が存在すれば読み込み、全コマンドに環境変数を渡す
ifneq (,$(wildcard .env.test))
  include .env.test
  export
endif

PID_DIR := .pids

# ─── DB ────────────────────────────────────────────────
db:
	docker compose up -d

db-stop:
	docker compose down

db-reset:
	docker compose down -v && docker compose up -d

# ─── 初期セットアップ (初回のみ) ─────────────────────────
setup: db
	@echo "==> Installing dependencies..."
	pnpm install
	cd services/ai && uv sync
	@echo "==> Running migration..."
	cd packages/db && pnpm generate && pnpm migrate
	@echo "==> Seeding test data..."
	pnpm seed-test
	@echo "==> Setup complete!"

# ─── 全サービス (フォアグラウンド, ログ混在) ───────────────
dev: db
	@echo "Starting all services..."
	@make -j auth-dev feed-dev ai-dev notification-dev web-dev

# ─── 全サービス (バックグラウンド, 個別ログ) ───────────────
ROOT_DIR := $(shell pwd)

dev-bg: dev-stop db
	@mkdir -p $(ROOT_DIR)/$(PID_DIR) $(ROOT_DIR)/logs
	@echo "Starting auth (port 3000)..."
	@cd services/auth && pnpm dev > $(ROOT_DIR)/logs/auth.log 2>&1 & echo $$! > $(ROOT_DIR)/$(PID_DIR)/auth.pid
	@echo "Starting feed (port 3001)..."
	@cd services/feed && pnpm dev > $(ROOT_DIR)/logs/feed.log 2>&1 & echo $$! > $(ROOT_DIR)/$(PID_DIR)/feed.pid
	@echo "Starting ai (port 3003)..."
	@cd services/ai && uv run uvicorn src.main:app --reload --port 3003 > $(ROOT_DIR)/logs/ai.log 2>&1 & echo $$! > $(ROOT_DIR)/$(PID_DIR)/ai.pid
	@echo "Starting notification (port 3004)..."
	@cd services/notification && pnpm dev > $(ROOT_DIR)/logs/notification.log 2>&1 & echo $$! > $(ROOT_DIR)/$(PID_DIR)/notification.pid
	@echo "Starting web (port 5173)..."
	@cd apps/web && pnpm dev > $(ROOT_DIR)/logs/web.log 2>&1 & echo $$! > $(ROOT_DIR)/$(PID_DIR)/web.pid
	@sleep 3
	@echo "All services started. Logs: logs/<service>.log"
	@echo "Stop with: make dev-stop"

# ─── 全サービス停止 ───────────────────────────────────────
dev-stop:
	@if [ -d $(PID_DIR) ]; then \
		for f in $(PID_DIR)/*.pid; do \
			if [ -f "$$f" ]; then \
				pid=$$(cat "$$f"); \
				kill $$pid 2>/dev/null && echo "Stopped $$(basename $$f .pid) (pid $$pid)" || true; \
				rm -f "$$f"; \
			fi; \
		done; \
		rmdir $(PID_DIR) 2>/dev/null || true; \
	fi
	@pkill -f "tsx watch" 2>/dev/null || true
	@pkill -f "uvicorn src.main:app" 2>/dev/null || true
	@pkill -f "vinxi" 2>/dev/null || true
	@echo "All services stopped."

build:
	cd services/auth && pnpm build
	cd services/feed && pnpm build
	cd services/notification && pnpm build
	cd services/ai && uv build
	cd apps/web && pnpm build
	cd apps/cli && cargo build --release

test:
	cd services/auth && pnpm test
	cd services/feed && pnpm test
	cd services/notification && pnpm test
	cd services/ai && uv run pytest
	cd apps/web && pnpm test
	cd apps/cli && cargo test

lint:
	cd services/auth && pnpm lint
	cd services/feed && pnpm lint
	cd services/notification && pnpm lint
	cd services/ai && uv run ruff check .
	cd apps/web && pnpm lint
	cd apps/cli && cargo clippy --all-targets -- -D warnings

typecheck:
	cd services/auth && pnpm typecheck
	cd services/feed && pnpm typecheck
	cd services/notification && pnpm typecheck
	cd services/ai && uv run pyright .
	cd apps/web && pnpm typecheck

# ─── 個別サービス dev ───────────────────────────────────
auth-dev:
	cd services/auth && pnpm dev

feed-dev:
	cd services/feed && pnpm dev

ai-dev:
	cd services/ai && uv run uvicorn src.main:app --reload --port 3003

notification-dev:
	cd services/notification && pnpm dev

web-dev:
	cd apps/web && pnpm dev

# ─── 個別サービス test ──────────────────────────────────
auth-test:
	cd services/auth && pnpm test

feed-test:
	cd services/feed && pnpm test

ai-test:
	cd services/ai && uv run pytest

notification-test:
	cd services/notification && pnpm test

web-test:
	cd apps/web && pnpm test

cli-test:
	cd apps/cli && cargo test

# ─── DB マイグレーション ────────────────────────────────
migrate:
	cd packages/db && pnpm generate && pnpm migrate

# ─── 結合テスト ──────────────────────────────────────────
seed-test:
	cd scripts && npx tsx seed-test-data.ts

test-integration: db
	cd tests/integration && pnpm test

# ─── CDK デプロイ ──────────────────────────────────────────
deploy:
	cd infra && npx cdk deploy --all

deploy-diff:
	cd infra && npx cdk diff --all

destroy:
	cd infra && npx cdk destroy --all

# ─── クリーンアップ ─────────────────────────────────────
clean:
	rm -rf services/*/dist services/*/node_modules
	rm -rf apps/*/dist apps/*/node_modules
	rm -rf packages/*/dist packages/*/node_modules
	cd apps/cli && cargo clean
