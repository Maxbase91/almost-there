#!/usr/bin/env bash
# Runs the GitHub CI checks locally; the global pre-push hook runs it on `git push`.
# Mirrors .github/workflows/ci.yml, job `test`: npm ci, npm test (Vitest).
# CI-only: nothing.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm ci

echo "== test"; npm test --silent
echo "verify: OK"
