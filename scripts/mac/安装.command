#!/bin/bash
# =============================================================================
#  日记自动同步 · Mac 一键安装
#
#  在 Finder 里双击本文件即可。若双击没反应或提示无法打开：
#    右键 → 打开；或在终端里执行：  chmod +x 安装.command && ./安装.command
#
#  安装原则：只往里加，不往外删。已有的私有原稿、化名规则一律原样保留。
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"
PACKAGE_ROOT="$PWD"

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; RED=$'\033[31m'
YELLOW=$'\033[33m'; BLUE=$'\033[36m'; OFF=$'\033[0m'

step() { printf '\n%s▸ %s%s\n' "$BOLD" "$1" "$OFF"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$OFF" "$1"; }
info() { printf '  %s·%s %s\n' "$BLUE" "$OFF" "$1"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$OFF" "$1"; }
die()  { printf '\n  %s✗ %s%s\n\n' "$RED" "$1" "$OFF"; exit 1; }

REPO="https://github.com/hedapeng1984/hedapeng1984.github.io.git"
SITE_DIR="$PACKAGE_ROOT/site"
PRIVATE_DIR="$PACKAGE_ROOT/private"
TEMPLATE_DIR="$PACKAGE_ROOT/private-template"

printf '%s\n' "$BOLD"
printf '  日记自动同步 · 安装程序\n'
printf '  目标站点：https://www.hedapeng.com\n'
printf '%s\n\n' "$OFF"

# ---------------------------------------------------------------- 1. 环境检查
step "检查运行环境"

if [[ "$(uname)" != "Darwin" ]]; then
  die "这个安装包只能在 macOS 上运行。"
fi
ok "macOS $(sw_vers -productVersion)"

if ! command -v node >/dev/null 2>&1; then
  die "找不到 node。请先安装 Node.js 22.12 或更新的 LTS：https://nodejs.org"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if (( NODE_MAJOR < 22 )) || { (( NODE_MAJOR == 22 )) && (( NODE_MINOR < 12 )); }; then
  die "需要 Node.js 22.12 或更新的 LTS，当前是 $(node -v)。"
fi
ok "Node.js $(node -v)"

if ! command -v git >/dev/null 2>&1; then
  die "找不到 git。请先安装 Xcode 命令行工具：xcode-select --install"
fi
ok "Git $(git --version | awk '{print $3}')"

if ! git ls-remote --exit-code "$REPO" HEAD >/dev/null 2>&1; then
  die "连不上 GitHub，无法取得网站代码。请检查网络后重试。"
fi
ok "能连上 GitHub"

# ------------------------------------------------------- 2. 取得网站代码
step "准备网站代码"

if [[ -d "$SITE_DIR/.git" ]]; then
  info "已有 site 目录，尝试更新到最新版…"
  if git -C "$SITE_DIR" status --porcelain | grep -q .; then
    warn "site 里有未提交的改动，本次不动它，继续使用现有版本。"
  elif git -C "$SITE_DIR" pull --ff-only >/dev/null 2>&1; then
    ok "已更新到最新版"
  else
    warn "更新失败（可能有本地提交），继续使用现有版本。"
  fi
else
  info "克隆网站代码（第一次会慢一点）…"
  git clone "$REPO" "$SITE_DIR" >/dev/null || die "克隆失败。"
  ok "已克隆"
fi

git -C "$SITE_DIR" config user.name "hedapeng1984" >/dev/null 2>&1 || true
git -C "$SITE_DIR" config user.email "hedapeng1984@users.noreply.github.com" >/dev/null 2>&1 || true

step "安装依赖并跑测试"
cd "$SITE_DIR"
if ! npm ci >/dev/null 2>&1; then
  printf '\n'
  npm ci || die "依赖安装失败。"
fi
ok "依赖就绪"
if npm test >/dev/null 2>&1; then
  ok "测试通过"
else
  npm test || true
  die "测试没有通过，先别装任务。"
fi
cd "$PACKAGE_ROOT"

# ------------------------------------------------------- 3. 准备私有目录
step "准备私有目录"

mkdir -p "$PRIVATE_DIR/originals" "$PRIVATE_DIR/review"

ADDED=0
if [[ -d "$TEMPLATE_DIR/originals" ]]; then
  for file in "$TEMPLATE_DIR"/originals/*.md; do
    [[ -e "$file" ]] || continue
    name="$(basename "$file")"
    if [[ -e "$PRIVATE_DIR/originals/$name" ]]; then
      continue
    fi
    cp "$file" "$PRIVATE_DIR/originals/$name"
    ADDED=$((ADDED + 1))
  done
fi
if (( ADDED > 0 )); then
  ok "补入 $ADDED 份原稿（已存在的原稿原样保留）"
else
  ok "原稿目录就绪（已有内容未被改动）"
fi

if [[ -f "$TEMPLATE_DIR/privacy-rules.json" && ! -f "$PRIVATE_DIR/privacy-rules.json" ]]; then
  cp "$TEMPLATE_DIR/privacy-rules.json" "$PRIVATE_DIR/privacy-rules.json"
  ok "已放入化名替换规则"
elif [[ -f "$PRIVATE_DIR/privacy-rules.json" ]]; then
  ok "化名替换规则已存在，未改动"
else
  die "缺少化名替换规则：$TEMPLATE_DIR/privacy-rules.json"
fi

# ------------------------------------------------------- 4. 配置原稿来源
step "配置原稿来源"

if [[ -f "$PRIVATE_DIR/sources.json" ]]; then
  ok "原稿来源配置已存在，未改动"
  info "$PRIVATE_DIR/sources.json"
else
  DEFAULT_DIR=""
  if [[ -d "$HOME/Documents/日记原稿" ]]; then
    DEFAULT_DIR="$HOME/Documents/日记原稿"
  elif [[ -d "$HOME/Documents" ]]; then
    DEFAULT_DIR="$HOME/Documents"
  fi
  printf '  Mac 上存放日记原稿（Markdown）的目录是哪里？\n'
  printf '  %s可以直接回车用 %s%s\n' "$DIM" "${DEFAULT_DIR:-$HOME/Documents}" "$OFF"
  printf '  %s提示：目录不存在也没关系，之后随时能改 %s/private/sources.json%s\n' "$DIM" "$DIM" "$OFF"
  printf '  > '
  read -r ANSWER || ANSWER=""
  ANSWER="${ANSWER:-$DEFAULT_DIR}"
  [[ -n "$ANSWER" ]] || ANSWER="$HOME/Documents"

  mkdir -p "$PRIVATE_DIR"
  cat > "$PRIVATE_DIR/sources.json" <<JSON
{
  "sources": [
    "$ANSWER"
  ],
  "extensions": [".md"]
}
JSON
  ok "已写入 $PRIVATE_DIR/sources.json"
  if [[ -d "$ANSWER" ]]; then
    info "目录存在，同步时会把里面的 Markdown 收进原稿目录"
  else
    warn "目录目前不存在。建好之后，或者把 Markdown 放进去，下次同步就会生效。"
  fi
fi

# ------------------------------------------------------- 5. 安装后台任务
step "安装后台任务（每 5 分钟检查一次）"

if zsh "$SITE_DIR/scripts/install-macos-agent.sh"; then
  ok "后台任务已安装"
else
  die "后台任务安装失败。Mac 的系统任务需要你的登录权限，"
fi

# ------------------------------------------------------- 6. 首次准备
step "首次整理原稿"
cd "$SITE_DIR"
if npm run prepare:diaries >/dev/null 2>&1; then
  ok "原稿已整理成待审稿"
  node scripts/content.mjs status | sed 's/^/    /'
  info "待审稿在 $PRIVATE_DIR/review/，读完后再 approve"
else
  warn "整理原稿时遇到问题，原稿没有被改动。手动执行下面这行看详情："
  info "  cd '$SITE_DIR' && npm run prepare:diaries"
fi
cd "$PACKAGE_ROOT"

# ------------------------------------------------------- 7. 总结
printf '\n%s' "$BOLD"
printf '  安装完成\n'
printf '%s\n\n' "$OFF"
cat <<SUMMARY
  网站      https://www.hedapeng.com
  代码      $SITE_DIR
  私有目录  $PRIVATE_DIR

  日志      ~/Library/Logs/hedapeng-journal/sync.log
  看日志    tail -f ~/Library/Logs/hedapeng-journal/sync.log
  立刻跑一次  cd "$SITE_DIR" && zsh scripts/sync-macos.sh
  重新安装   在本目录再次双击 安装.command
  卸载任务   在本目录双击 卸载.command

  下一篇怎么发
    1. 把 Markdown 放进上面配置的原稿目录
    2. cd "$SITE_DIR" && npm run prepare:diaries
    3. 读一遍 ../private/review/<id>.md，改干净
    4. node scripts/content.mjs approve <id> --i-reviewed-content
    5. 后台任务会在几分钟内自动发布

  未审核的新稿会阻止自动推送，这是刻意的。
SUMMARY

printf '  %s提示：Mac 休眠、关机或退出登录时任务不运行，醒来后自动补跑。%s\n\n' "$DIM" "$OFF"
