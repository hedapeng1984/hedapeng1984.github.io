#!/bin/bash
# =============================================================================
#  日记自动同步 · 卸载后台任务
#
#  只停掉后台任务并删掉 launchd 配置。
#  私有原稿、待审稿、网站代码都原样留着；删不删由你最后确认。
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

LABEL="com.hedapeng.journal-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/hedapeng-journal"
SITE_DIR="$PWD/site"

printf '%s\n' "$BOLD"
printf '  日记自动同步 · 卸载\n'
printf '%s\n\n' "$OFF"

step "停止后台任务"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  ok "任务已停止"
else
  ok "任务当前没有在运行"
fi

if [[ -e "$PLIST" ]]; then
  rm -f "$PLIST"
  ok "已删除任务配置：$PLIST"
fi

if [[ -d "$LOG_DIR" ]]; then
  printf '\n  %s日志目录还在：%s%s\n' "$DIM" "$LOG_DIR" "$OFF"
  printf '  %s要删掉请执行：rm -rf "%s"%s\n' "$DIM" "$LOG_DIR" "$OFF"
fi

step "剩下的东西（都保留着）"
info "私有原稿与待审稿：$PWD/private"
info "网站代码：$SITE_DIR"
info "网站本身由 GitHub Pages 托管，卸载任务不会影响线上站点。"

printf '\n  %s想恢复后台任务：重新双击 安装.command%s\n\n' "$DIM" "$OFF"
