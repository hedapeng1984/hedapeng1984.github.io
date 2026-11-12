#!/bin/zsh
# 安装（或重装）Mac 端的登录用户 LaunchAgent：每 5 分钟检查一次日记同步。
#
# 说明：
# 1. 这是 gui/ 域下的登录用户任务，Mac 休眠、关机、退出登录时不保证运行；恢复后会自动补跑。
#    网站本身由 GitHub Pages 托管，不依赖这台 Mac 一直开机。
# 2. 不覆盖已有配置：已存在同名 plist 时先卸载再安装，避免丢掉你手改过的参数。
# 3. node 的路径由 scripts/sync-macos.sh 自己在运行时解析，因此 nvm 换版本也不会失效。
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.hedapeng.journal-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/hedapeng-journal"
INTERVAL=300

if ! command -v node >/dev/null 2>&1; then
  echo "找不到 node。请先安装 Node.js 22.12 或更新的 LTS。" >&2
  exit 1
fi
NODE_VERSION="$(node -v)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if (( NODE_MAJOR < 22 )) || { (( NODE_MAJOR == 22 )) && (( NODE_MINOR < 12 )); }; then
  echo "需要 Node.js 22.12 或更新的 LTS，当前是 $NODE_VERSION。" >&2
  exit 1
fi

if [[ ! -d "$SITE_DIR/.git" ]]; then
  echo "网站目录不是 git 仓库：$SITE_DIR" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

# 私有目录：任务运行时必须和手动执行时指向同一个位置
PRIVATE_DIR="${DIARY_PRIVATE_DIR:-$SITE_DIR/../private}"
if [[ ! -d "$PRIVATE_DIR" ]]; then
  echo "私有目录不存在：$PRIVATE_DIR" >&2
  echo "请先确认 private/originals 与 private/privacy-rules.json 已经就位。" >&2
  exit 1
fi

# 原稿源配置：没有就写一份模板，提示用户填写
SOURCES_JSON="$PRIVATE_DIR/sources.json"
if [[ ! -f "$SOURCES_JSON" ]]; then
  cat > "$SOURCES_JSON" <<'JSON'
{
  "sources": [
    "~/Documents/日记原稿"
  ],
  "extensions": [".md"]
}
JSON
  echo "已写入原稿源配置模板：$SOURCES_JSON"
  echo "  请把 sources 改成 Mac 上真正存放原稿 Markdown 的目录。"
fi

# 先卸载旧的，避免 launchctl 因重复加载失败
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "检测到已加载的旧任务，先卸载。"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
fi
if [[ -e "$PLIST" ]]; then
  BACKUP="$PLIST.bak.$(date '+%Y%m%d%H%M%S')"
  mv "$PLIST" "$BACKUP"
  echo "原配置已备份到：$BACKUP"
fi

export JOURNAL_AGENT_SITE="$SITE_DIR"
export JOURNAL_AGENT_LOG="$LOG_DIR"
export JOURNAL_AGENT_PLIST="$PLIST"
export JOURNAL_AGENT_PRIVATE="$PRIVATE_DIR"
export JOURNAL_AGENT_LABEL="$LABEL"
export JOURNAL_AGENT_INTERVAL="$INTERVAL"
export JOURNAL_AGENT_NODE_PATH="$(dirname "$(command -v node)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

node --input-type=module <<'NODE'
import fs from 'node:fs';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const site = escape(process.env.JOURNAL_AGENT_SITE);
const log = escape(process.env.JOURNAL_AGENT_LOG);
const nodePath = escape(process.env.JOURNAL_AGENT_NODE_PATH);
const privateDir = escape(process.env.JOURNAL_AGENT_PRIVATE);
const label = escape(process.env.JOURNAL_AGENT_LABEL);
const interval = Number(process.env.JOURNAL_AGENT_INTERVAL);

fs.writeFileSync(process.env.JOURNAL_AGENT_PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>/bin/zsh</string><string>${site}/scripts/sync-macos.sh</string></array>
<key>WorkingDirectory</key><string>${site}</string>
<key>EnvironmentVariables</key><dict>
<key>PATH</key><string>${nodePath}</string>
<key>DIARY_PRIVATE_DIR</key><string>${privateDir}</string>
<key>LANG</key><string>zh_CN.UTF-8</string>
</dict>
<key>StartInterval</key><integer>${interval}</integer>
<key>RunAtLoad</key><true/>
<key>ProcessType</key><string>Background</string>
<key>LowPriorityIO</key><true/>
<key>Nice</key><integer>5</integer>
<key>StandardOutPath</key><string>${log}/sync.log</string>
<key>StandardErrorPath</key><string>${log}/error.log</string>
</dict></plist>
`);
NODE

launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "已安装：每 $((INTERVAL / 60)) 分钟检查一次的登录用户任务。"
echo "  任务标识：$LABEL"
echo "  配置文件：$PLIST"
echo "  日志目录：$LOG_DIR"
echo "  私有目录：$PRIVATE_DIR"
echo
echo "查看状态：launchctl print gui/$(id -u)/$LABEL | head -20"
echo "立即手动跑一次：zsh $SITE_DIR/scripts/sync-macos.sh"
echo "看最近日志：tail -f '$LOG_DIR/sync.log'"
echo "卸载：zsh $SITE_DIR/scripts/uninstall-macos-agent.sh"
