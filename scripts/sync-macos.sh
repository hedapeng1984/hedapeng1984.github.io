#!/bin/zsh
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SITE_DIR"
node scripts/sync.mjs
