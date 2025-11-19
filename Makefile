SHELL := /bin/bash
COMPOSE ?= docker compose
DEV_FILES := -f docker-compose.yml -f docker-compose.dev.yml
DEV_COMPOSE := $(COMPOSE) $(DEV_FILES)
ENV_FILE ?= .env
ENV_TEMPLATE ?= .env.docker
ENV_SYNC_TARGETS ?= web/.env web/.env.local services/scheduler/.env services/playout/.env

.PHONY: help setup env env-sync dev dev-hot stop clean logs status restart migrate seed studio db-shell web-shell scheduler-shell playout-shell lint format format-check typecheck test quick-ci validate-config

help:
	@echo ""
	@echo "Common targets:"
	@echo "  make setup        # Copy $(ENV_TEMPLATE) -> $(ENV_FILE) (if needed) and sync child env files"
	@echo "  make env-sync     # Re-copy $(ENV_FILE) into $(ENV_SYNC_TARGETS)"
	@echo "  make dev          # Build + start the full stack with docker compose"
	@echo "  make dev-hot      # Start stack with hot reload overrides"
	@echo "  make stop         # Stop containers but keep volumes"
	@echo "  make clean        # Stop containers and remove volumes"
	@echo "  make lint         # Run lint across all packages"
	@echo "  make format       # Format code across all packages"
	@echo "  make format-check # Verify formatting across all packages"
	@echo "  make typecheck    # Run TypeScript type checks"
	@echo "  make test         # Run all test suites"
	@echo "  make quick-ci     # Run the quick CI harness (lint/type/test/build/config)"
	@echo "  make validate-config # Validate JSON config files"
	@echo "  make logs         # Follow logs for all services"
	@echo "  make status       # Show container status"
	@echo "  make migrate      # Run Prisma migrations inside the web container"
	@echo "  make seed         # Seed the database via the web container"
	@echo "  make studio       # Launch Prisma Studio via the web container"
	@echo "  make db-shell     # Open a psql shell inside the postgres container"
	@echo ""

setup:
	@if [ ! -f "$(ENV_TEMPLATE)" ]; then \
		echo "Missing $(ENV_TEMPLATE). Cannot bootstrap environment."; \
		exit 1; \
	fi
	@if [ ! -f "$(ENV_FILE)" ]; then \
		cp "$(ENV_TEMPLATE)" "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE) from $(ENV_TEMPLATE)."; \
	else \
		echo "$(ENV_FILE) already exists. Skipping copy."; \
	fi
	@$(MAKE) env-sync
	@echo "Update $(ENV_FILE) with your secrets before running make dev."

env env-sync:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Missing $(ENV_FILE). Run 'make setup' first."; \
		exit 1; \
	fi
	@for target in $(ENV_SYNC_TARGETS); do \
		dirname=$$(dirname $$target); \
		mkdir -p "$$dirname"; \
		cp "$(ENV_FILE)" "$$target"; \
		echo "Synced $(ENV_FILE) -> $$target"; \
	done

lint:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

test:
	npm run test

quick-ci:
	npm run ci:quick

validate-config:
	npm run config:validate

dev:
	$(COMPOSE) up --build

dev-hot:
	$(DEV_COMPOSE) up --build

stop:
	$(COMPOSE) down

clean:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f

status:
	$(COMPOSE) ps

restart:
	$(COMPOSE) restart

migrate:
	$(COMPOSE) exec web npx prisma migrate deploy

seed:
	$(COMPOSE) exec web npx tsx prisma/seed/seed.ts

studio:
	$(COMPOSE) exec web npx prisma studio

db-shell:
	$(COMPOSE) exec postgres psql -U "$${POSTGRES_USER:-lofield}" "$${POSTGRES_DB:-lofield_fm}"

web-shell:
	$(COMPOSE) exec web sh

scheduler-shell:
	$(COMPOSE) exec scheduler sh

playout-shell:
	$(COMPOSE) exec playout sh

