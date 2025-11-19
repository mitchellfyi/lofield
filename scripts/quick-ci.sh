#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "[lofield] Running lint checks..."
npm run lint

echo "[lofield] Checking formatting..."
npm run format:check

echo "[lofield] Running type checks..."
npm run typecheck

echo "[lofield] Running test suites..."
npm run test:ci

echo "[lofield] Generating Prisma client..."
npm run prisma:generate:web

echo "[lofield] Building web app..."
npm run build:web

echo "[lofield] Validating configuration..."
npm run config:validate

echo "[lofield] Quick CI checks completed successfully."

