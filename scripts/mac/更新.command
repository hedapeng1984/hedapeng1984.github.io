#!/bin/bash
# =============================================================================
#  日记自动同步 · 更新
#
#  在 Finder 里双击本文件：拉取最新网站代码、重装依赖、重装后台任务、跑一次同步。
#  私有原稿与化名规则不会被改动。
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; RED=$'\033[31m'
YELLOW=$'\033[33m'; BLUE=$'\033[36m'; OFF=$'\033[0m'

step() { printf '\n%s▸ %s%s\n' "$BOLD" "$1" "$OFF"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$OFF" "$1"; }
info() { printf '  %s·%s %s\n' "$BLUE" "$OFF" "$1"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$OFF" "$1"; }
die()  { printf '\n  %s✗ %s%s\n\n' "$RED" "$1" "$OFF"; exit 1; }

SITE_DIR="$PWD/site"
PRIVATE_DIR="$PWD/private"

printf '%s\n' "$BOLD"
printf '  日记自动同步 · 更新\n'
printf '%s\n\n' "$OFF"

[[ -d "$SITE_DIR/.git" ]] || die "还没安装过。先双击 安装.command。"

step "拉取最新代码"
cd "$SITE_DIR"
if git status --porcelain | grep -q .; then
  warn "有未提交的改动，本次不更新，继续用现有版本。"
else
  if git pull --ff-only >/dev/null 2>&1; then
    ok "已更新到 $(git log --format='%h %s' -1)"
  else
    warn "更新失败（可能有本地提交或远端冲突），继续用现有版本。"
  fi
fi

step "重装依赖并跑测试"
npm ci --silent >/dev/null 2>&1 || npm ci >/dev/null || die "依赖安装失败。"
ok "依赖就绪"
npm test >/dev/null 2>&1 && ok "测试通过" || die "测试没有通过，先别更新任务。"

step "重装后台任务"
zsh scripts/install-macos-agent.sh >/dev/null || die "后台任务安装失败。"
ok "后台任务已刷新"

step "整理原稿"
npm run prepare:diaries >/dev/null 2>&1 && ok "原稿已整理" || warn "整理遇到问题，原稿没被改动。"
node scripts/content.mjs status 2>/dev/null | sed 's/^/    /' || true

step "跑一次同步"
zsh scripts/sync-macos.sh 2>&1 | sed 's/^/  /' || warn "同步未完成，详情见日志。"

printf '\n  %s日志：~/Library/Logs/hedapeng-journal/sync.log%s\n' "$DIM" "$OFF"
printf '  %s网站：https://www.hedapeng.com%s\n\n' "$DIM" "$OFF"
