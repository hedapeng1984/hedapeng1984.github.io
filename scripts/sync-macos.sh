#!/bin/zsh
# Mac 端自动同步入口：先同步原稿，再走"脱敏 → 审核拦截 → 构建 → 推送"。
#
# 关键点：
# 1. 自己解析 node 路径。launchd 不读 .zshrc，nvm 装的 node 不 source 就会找不到。
# 2. 每次只做一件确定的事：有待审稿就停，不推送；没有变化就不构建不推送。
# 3. 用 caffeinate 包住，避免构建过程中 Mac 进入空闲睡眠。
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"

# nvm 装的 node：把当前默认版本加进 PATH
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SITE_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "找不到 node。请安装 Node.js 22.12 或更新的 LTS；若用 nvm 管理，请确认 nvm 已安装并在同一台机器上默认启用了该版本。" >&2
  exit 1
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if (( NODE_MAJOR < 22 )) || { (( NODE_MAJOR == 22 )) && (( NODE_MINOR < 12 )); }; then
  echo "需要 Node.js 22.12 或更新的 LTS，当前是 $NODE_VERSION。" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "找不到 git。" >&2
  exit 1
fi

echo "=== 同步开始 $(date '+%Y-%m-%d %H:%M:%S') · node $NODE_VERSION ==="

# 1. 把 Mac 上的原稿源目录同步进 private/originals/
node scripts/sync-sources.mjs "$@" || true

# 2. 脱敏、审核拦截、构建、推送
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i node scripts/sync.mjs
else
  node scripts/sync.mjs
fi

echo "=== 同步结束 $(date '+%Y-%m-%d %H:%M:%S') ==="
