#!/bin/zsh
# 卸载 Mac 端的日记同步 LaunchAgent。
#
# 默认保留配置和日志：
#   --purge 会连同 plist 和日志目录一起删掉。
set -euo pipefail

LABEL="com.hedapeng.journal-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/hedapeng-journal"
PURGE=0
[[ "${1:-}" == "--purge" ]] && PURGE=1

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  echo "已停止运行中的任务。"
else
  echo "任务当前未加载。"
fi

if [[ -e "$PLIST" ]]; then
  if (( PURGE )); then
    rm -f "$PLIST"
    echo "已删除配置文件：$PLIST"
  else
    echo "已卸载，保留配置文件：$PLIST"
    echo "  如需彻底删除，运行：zsh $0 --purge"
  fi
fi

if (( PURGE )) && [[ -d "$LOG_DIR" ]]; then
  rm -rf "$LOG_DIR"
  echo "已删除日志目录：$LOG_DIR"
fi

echo "卸载完成。私有的原稿与审核记录未受影响。"
