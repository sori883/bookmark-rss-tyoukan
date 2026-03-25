.PHONY: db db-stop dev build test clean \
       auth-dev bff-dev feed-dev ai-dev notification-dev web-dev \
       auth-test bff-test feed-test ai-test notification-test web-test cli-test \
       migrate lint typecheck \
       seed-test test-integration

# ─── DB ────────────────────────────────────────────────
db:
	docker compose up -d

db-stop:
	docker compose down

db-reset:
	docker compose down -v && docker compose up -d

# ─── 全サービス ─────────────────────────────────────────
dev: db
	@echo "Starting all services..."
	@make -j auth-dev bff-dev feed-dev ai-dev notification-dev web-dev

build:
	cd services/auth && pnpm build
	cd services/bff && pnpm build
	cd services/feed && pnpm build
	cd services/notification && pnpm build
	cd services/ai && uv build
	cd apps/web && pnpm build
	cd apps/cli && cargo build --release

test:
	cd services/auth && pnpm test
	cd services/bff && pnpm test
	cd services/feed && pnpm test
	cd services/notification && pnpm test
	cd services/ai && uv run pytest
	cd apps/web && pnpm test
	cd apps/cli && cargo test

lint:
	cd services/auth && pnpm lint
	cd services/bff && pnpm lint
	cd services/feed && pnpm lint
	cd services/notification && pnpm lint
	cd services/ai && uv run ruff check .
	cd apps/web && pnpm lint
	cd apps/cli && cargo clippy --all-targets -- -D warnings

typecheck:
	cd services/auth && pnpm typecheck
	cd services/bff && pnpm typecheck
	cd services/feed && pnpm typecheck
	cd services/notification && pnpm typecheck
	cd services/ai && uv run pyright .
	cd apps/web && pnpm typecheck

# ─── 個別サービス dev ───────────────────────────────────
auth-dev:
	cd services/auth && pnpm dev

bff-dev:
	cd services/bff && pnpm dev

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

bff-test:
	cd services/bff && pnpm test

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

# ─── クリーンアップ ─────────────────────────────────────
clean:
	rm -rf services/*/dist services/*/node_modules
	rm -rf apps/*/dist apps/*/node_modules
	rm -rf packages/*/dist packages/*/node_modules
	cd apps/cli && cargo clean
