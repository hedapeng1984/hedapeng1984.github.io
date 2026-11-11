#!/bin/zsh
set -euo pipefail
SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
command -v node >/dev/null || { echo "请先安装 Node.js 22.12+ 或更新的 LTS。"; exit 1; }
PLIST="$HOME/Library/LaunchAgents/com.hedapeng.journal-sync.plist"
LOG_DIR="$HOME/Library/Logs/hedapeng-journal"
if [[ -e "$PLIST" ]]; then
  echo "自动任务已存在：$PLIST；请先检查原配置，未覆盖。"
  exit 1
fi
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
export JOURNAL_AGENT_SITE="$SITE_DIR" JOURNAL_AGENT_LOG="$LOG_DIR" JOURNAL_AGENT_PLIST="$PLIST"
export JOURNAL_AGENT_NODE_PATH="$(dirname "$(command -v node)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
node --input-type=module <<'NODE'
import fs from 'node:fs';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const site = escape(process.env.JOURNAL_AGENT_SITE);
const log = escape(process.env.JOURNAL_AGENT_LOG);
const nodePath = escape(process.env.JOURNAL_AGENT_NODE_PATH);
fs.writeFileSync(process.env.JOURNAL_AGENT_PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.hedapeng.journal-sync</string>
<key>ProgramArguments</key><array><string>/bin/zsh</string><string>${site}/scripts/sync-macos.sh</string></array>
<key>WorkingDirectory</key><string>${site}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${nodePath}</string></dict>
<key>StartInterval</key><integer>300</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${log}/sync.log</string>
<key>StandardErrorPath</key><string>${log}/error.log</string>
</dict></plist>\n`);
NODE
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "已安装每 5 分钟检查的登录用户任务。日志：$LOG_DIR"
echo "卸载：launchctl bootout gui/$(id -u) '$PLIST'"
