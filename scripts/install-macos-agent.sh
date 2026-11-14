#!/bin/zsh
# 安装（或重装）Mac 端的登录用户 LaunchAgent：
#   1. com.hedapeng.journal-sync      —— 每 5 分钟同步一次（发布）
#   2. com.hedapeng.journal-watchdog  —— 每 30 分钟检查一次（守护发布链路）
#
# 说明：
# 1. 这是 gui/ 域下的登录用户任务，Mac 休眠、关机、退出登录时不保证运行；恢复后会自动补跑。
#    网站本身由 GitHub Pages 托管，不依赖这台 Mac 一直开机。
# 2. 不覆盖已有配置：已存在同名 plist 时先卸载再安装，避免丢掉你手改过的参数。
# 3. node 的路径由 scripts/sync-macos.sh 自己在运行时解析，因此 nvm 换版本也不会失效。
# 4. 守护脚本不依赖 node（node 缺失时其余检查照常），所以它自己解析 nvm，只为跑 content.mjs。
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.hedapeng.journal-sync"
WATCHDOG_LABEL="com.hedapeng.journal-watchdog"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
WATCHDOG_PLIST="$HOME/Library/LaunchAgents/$WATCHDOG_LABEL.plist"
LOG_DIR="$HOME/Library/Logs/hedapeng-journal"
INTERVAL=300
WATCHDOG_INTERVAL=1800

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

# 私有目录：任务运行时必须和手动执行时指向同一个位置。
# private/ 按设计不在仓库里（真实原稿不能上传），所以新克隆的机器上这里会是空的。
# 没有就建一个空的让流程能跑起来，真正的原稿与规则由使用者补齐。
PRIVATE_DIR="${DIARY_PRIVATE_DIR:-$SITE_DIR/../private}"
mkdir -p "$PRIVATE_DIR/originals" "$PRIVATE_DIR/review"

if [[ ! -f "$PRIVATE_DIR/privacy-rules.json" ]]; then
  cat > "$PRIVATE_DIR/privacy-rules.json" <<'JSON'
{
  "names": [],
  "alert": []
}
JSON
  echo "提示：已创建空的脱敏规则 $PRIVATE_DIR/privacy-rules.json"
  echo "      names 里写人名全名，整理时自动换成拼音首字母，例如："
  echo '        "names": ["王小明"]'
  echo "      alert 里写要盯的字串，整理时只提醒行号、不自动改，例如："
  echo '        "alert": ["某某市某某路12号"]'
  echo "      补上规则之前，请不要把带真实身份信息的稿件放进公开流程。"
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
for label in "$LABEL" "$WATCHDOG_LABEL"; do
  if launchctl print "gui/$(id -u)/$label" >/dev/null 2>&1; then
    echo "检测到已加载的旧任务 $label，先卸载。"
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  fi
done
for plist in "$PLIST" "$WATCHDOG_PLIST"; do
  if [[ -e "$plist" ]]; then
    BACKUP="$plist.bak.$(date '+%Y%m%d%H%M%S')"
    mv "$plist" "$BACKUP"
    echo "原配置已备份到：$BACKUP"
  fi
done

NODE_PATH_VALUE="$(dirname "$(command -v node)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# 生成一个 plist：$1 = 规格（JSON），$2 = 目标路径
write_plist() {
  JOURNAL_AGENT_SPEC="$1" JOURNAL_AGENT_PLIST="$2" node --input-type=module <<'NODE'
import fs from 'node:fs';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const spec = JSON.parse(process.env.JOURNAL_AGENT_SPEC);

const envDict = [
  `<key>PATH</key><string>${escape(spec.nodePath)}</string>`,
  `<key>LANG</key><string>${escape(spec.lang || 'zh_CN.UTF-8')}</string>`,
];
if (spec.private) envDict.push(`<key>DIARY_PRIVATE_DIR</key><string>${escape(spec.private)}</string>`);

fs.writeFileSync(process.env.JOURNAL_AGENT_PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${escape(spec.label)}</string>
<key>ProgramArguments</key><array><string>/bin/zsh</string><string>${escape(spec.program)}</string></array>
<key>WorkingDirectory</key><string>${escape(spec.site)}</string>
<key>EnvironmentVariables</key><dict>
${envDict.join('\n')}
</dict>
<key>StartInterval</key><integer>${Number(spec.interval)}</integer>
<key>RunAtLoad</key><true/>
<key>ProcessType</key><string>Background</string>
<key>LowPriorityIO</key><true/>
<key>Nice</key><integer>5</integer>
<key>StandardOutPath</key><string>${escape(spec.stdout)}</string>
<key>StandardErrorPath</key><string>${escape(spec.stderr)}</string>
</dict></plist>
`);
NODE
}

SYNC_SPEC=$(L="$LABEL" \
  P="$SITE_DIR/scripts/sync-macos.sh" \
  I="$INTERVAL" \
  O="$LOG_DIR/sync.log" \
  E="$LOG_DIR/error.log" \
  S="$SITE_DIR" \
  N="$NODE_PATH_VALUE" \
  V="$PRIVATE_DIR" \
  node -e 'console.log(JSON.stringify({label:process.env.L,program:process.env.P,interval:Number(process.env.I),stdout:process.env.O,stderr:process.env.E,site:process.env.S,nodePath:process.env.N,private:process.env.V}))')

WATCHDOG_SPEC=$(L="$WATCHDOG_LABEL" \
  P="$SITE_DIR/scripts/watchdog.sh" \
  I="$WATCHDOG_INTERVAL" \
  O="$LOG_DIR/health.log" \
  E="$LOG_DIR/health-error.log" \
  S="$SITE_DIR" \
  N="$NODE_PATH_VALUE" \
  node -e 'console.log(JSON.stringify({label:process.env.L,program:process.env.P,interval:Number(process.env.I),stdout:process.env.O,stderr:process.env.E,site:process.env.S,nodePath:process.env.N}))')

write_plist "$SYNC_SPEC" "$PLIST"
write_plist "$WATCHDOG_SPEC" "$WATCHDOG_PLIST"

launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl bootstrap "gui/$(id -u)" "$WATCHDOG_PLIST"

echo
echo "已安装两个登录用户任务："
echo "  同步  $LABEL   每 $((INTERVAL / 60)) 分钟  日志 $LOG_DIR/sync.log"
echo "  守护  $WATCHDOG_LABEL   每 $((WATCHDOG_INTERVAL / 60)) 分钟  日志 $LOG_DIR/health.log"
echo "  配置文件：$PLIST"
echo "            $WATCHDOG_PLIST"
echo "  私有目录：$PRIVATE_DIR"
echo
echo "查看状态：launchctl print gui/$(id -u)/$LABEL | head -20"
echo "立即手动跑一次同步：zsh $SITE_DIR/scripts/sync-macos.sh"
echo "立即手动跑一次守护：zsh $SITE_DIR/scripts/watchdog.sh"
echo "看最近日志：tail -f '$LOG_DIR/sync.log'"
echo "卸载：zsh $SITE_DIR/scripts/uninstall-macos-agent.sh"
