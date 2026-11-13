#!/bin/zsh
# 发布守护：检查「自动同步 → 推送 → 部署 → 上线」整条链路，异常时弹 macOS 通知。
#
# 为什么需要它：
#   这条链路上所有故障都是静默的。凭据失效、代理不通、CI 失败、Mac 睡着、有待审稿，
#   唯一的痕迹都是 error.log 里一行「git 失败，已停止同步。」——不看日志就等于没发生。
#   实测 65 轮同步里有 47 轮没跑完，用户一次都没察觉。
#
# 设计原则：
#   1. 只诊断 + 通知，不自动修复。自动修复会掩盖真实故障，让问题更难查。
#   2. 每项检查单独定性（正常 / 等人工审核 / 真故障），不能混成一个布尔值 ——
#      「有 2 篇稿子等你审」和「推送挂了」是两回事，混在一起会让用户把真故障也当噪声。
#   3. 区分确定性故障和链路抖动。github.com 会被成片重置（GFW 干扰），单次失败是常态。
#   4. 故障项用「集合 + 指纹」比对，而不是单一状态 —— 否则第二个故障会被第一个吞掉。
#   5. 不依赖 node、jq 等额外工具。node 缺失时其余检查照常。
#
# 触发方式：LaunchAgent（com.hedapeng.journal-watchdog），每 30 分钟一次。

set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${JOURNAL_LOG_DIR:-$HOME/Library/Logs/hedapeng-journal}"
SYNC_LOG="$LOG_DIR/sync.log"
ERROR_LOG="$LOG_DIR/error.log"
STATE_FILE="${JOURNAL_STATE_FILE:-$SITE_DIR/.cache/health-state.env}"
REPO="${JOURNAL_REPO:-hedapeng1984/hedapeng1984.github.io}"
API="${JOURNAL_API:-https://api.github.com/repos/$REPO}"
SITE_URL="${JOURNAL_SITE_URL:-https://www.hedapeng.com}"

# 阈值（都可用环境变量覆盖，便于临时放宽做排查）
IDLE_MINUTES="${HEALTH_IDLE_MINUTES:-45}"          # 多久没有新一轮同步算「任务没在跑」
FAIL_STREAK="${HEALTH_FAIL_STREAK:-2}"              # 连续几轮坏才判定为故障（抗抖动）
UNSTABLE_ROUNDS="${HEALTH_UNSTABLE_ROUNDS:-3}"      # 链路不稳连续几轮才升级
NOTIFY_COOLDOWN_MIN="${HEALTH_NOTIFY_COOLDOWN_MIN:-30}"
REMIND_HOURS="${HEALTH_REMIND_HOURS:-24}"           # 持续故障多久后补一次提醒
SLEEP_GRACE_MIN="${HEALTH_SLEEP_GRACE_MIN:-90}"     # 超过这个间隔没跑，怀疑机器睡过
TOKEN_WARN_DAYS="${HEALTH_TOKEN_WARN_DAYS:-30}"     # token 过期前多少天开始提醒
CURL_MAX_TIME="${HEALTH_CURL_MAX_TIME:-20}"
# 取凭据的命令。默认走 macOS 钥匙串；可覆盖是为了能注入故障做自测
# （脚本是直接调 helper 的，改 git 配置里的 credential.helper 对它无效）。
CRED_HELPER="${HEALTH_CREDENTIAL_HELPER:-git credential-osxkeychain get}"

FORCE_NOTIFY=0
QUIET=0
for arg in "$@"; do
  case "$arg" in
    --force-notify) FORCE_NOTIFY=1 ;;
    --quiet) QUIET=1 ;;
  esac
done

cd "$SITE_DIR"
mkdir -p "$(dirname "$STATE_FILE")"

# node 可能由 nvm 管理，launchd 不读 .zshrc，要自己解析（与 sync-macos.sh 一致）
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

OUT=""
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# 文本走 argv 传给 AppleScript，不塞进 -e 里 —— 省掉一整类转义问题。
notify() {
  local title="$1" body="$2" subtitle="${3:-}" out rc=0
  out=$(osascript -e 'on run argv' \
    -e 'display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv)' \
    -e 'end run' "$body" "$title" "$subtitle" 2>&1) || rc=$?
  if (( rc != 0 )); then
    log "通知发送失败（osascript 退出码 $rc）：$out"
    return 1
  fi
  # 注意：权限被拒时 osascript 仍返回 0，所以这里只能保证「命令本身没出错」，
  # 弹没弹出来要靠人眼确认。health.log 才是权威记录。
  log "已通知：$title · $body"
  return 0
}

# 守护自己崩了 = 没有任何告警在跑，是最坏的失败方式。
# set -e 下任何一处未预期的失败都会让脚本静默退出，所以这里兜住它：
# 记一行错误日志 + 立刻发一条通知，让"守护挂了"这件事本身可见。
on_error() {
  local rc="$1" line="$2"
  trap - ZERR
  log "守护脚本异常中止（退出码 $rc，第 ${line} 行）"
  notify "日记发布守护 · 守护进程异常" \
    "守护脚本在检查过程中崩了（退出码 $rc，第 ${line} 行）" \
    "详见 health-error.log" || true
  exit 2
}
trap 'on_error $? $LINENO' ZERR

# 带超时的执行。macOS 没有 timeout 命令；perl 的 alarm 跨 exec 生效（实测有效）。
# 输出放进全局变量 OUT，返回被调用者的退出码（超时为 142）。
run_timeout() {
  local seconds="$1"; shift
  local rc=0
  OUT=$(perl -e 'alarm shift; exec @ARGV' "$seconds" "$@" 2>/dev/null) || rc=$?
  return $rc
}

# 读状态文件里的一个键
state_get() {
  local key="$1" default="${2:-}" value=""
  [[ -f "$STATE_FILE" ]] || { printf '%s' "$default"; return 0; }
  value=$(grep -m1 "^${key}=" "$STATE_FILE" 2>/dev/null | cut -d= -f2- || true)
  printf '%s' "${value:-$default}"
}

# UTC ISO 时间戳 → Unix 秒
iso_to_epoch() {
  local iso="${1%%.*}"
  iso="${iso%Z}"
  [[ -n "$iso" ]] || return 1
  date -j -u -f "%Y-%m-%dT%H:%M:%S" "$iso" +%s 2>/dev/null
}

# 本地时间「YYYY-MM-DD HH:MM:SS」→ Unix 秒
local_to_epoch() {
  local ts="$1"
  [[ -n "$ts" ]] || return 1
  date -j -f "%Y-%m-%d %H:%M:%S" "$ts" +%s 2>/dev/null
}

now_epoch=$(date -u +%s)
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
last_run_epoch=$(iso_to_epoch "$(state_get lastRunAt "")" || echo "")

# ---------------------------------------------------------------- 各项检查
# 每项产出 RES_<名字>（ok/unknown/warn/fail/unstable）与 DET_<名字>。

RES_alive="ok";   DET_alive="任务在跑"
RES_round="ok";   DET_round="上一轮正常结束"
RES_cred="ok";    DET_cred="凭据有效"
RES_remote="ok";  DET_remote="本地与远端一致"
RES_chain="ok";   DET_chain="推送路径可用"
RES_proxy="ok";   DET_proxy="代理可达"
RES_site="ok";    DET_site="线上内容与本地一致"
RES_live="ok";    DET_live="线上可达"
PENDING=0

# C1 任务是否还在跑：看最后一个「=== 同步开始」，不看「最后成功同步」——
# 后者会把「有稿子等你审」误判成故障（实测那段时间停了 21 小时）。
check_alive() {
  local line ts epoch age
  [[ -f "$SYNC_LOG" ]] || { RES_alive="unknown"; DET_alive="sync.log 不存在"; return 0; }
  line=$(grep -E '^=== 同步开始' "$SYNC_LOG" 2>/dev/null | tail -1 || true)
  [[ -n "$line" ]] || { RES_alive="unknown"; DET_alive="sync.log 里没有同步记录"; return 0; }
  ts=$(printf '%s' "$line" | sed -E 's/^=== 同步开始 ([0-9-]+ [0-9:]+).*/\1/')
  epoch=$(local_to_epoch "$ts" || echo "")
  [[ -n "$epoch" ]] || { RES_alive="unknown"; DET_alive="时间戳解析失败：$ts"; return 0; }
  age=$(( (now_epoch - epoch) / 60 ))
  if (( age > IDLE_MINUTES )); then
    RES_alive="fail"; DET_alive="已经 ${age} 分钟没有新的同步轮次"
  else
    RES_alive="ok"; DET_alive="最近一轮在 ${age} 分钟前"
  fi
  return 0
}

# C2 最后一轮的状态：正常结束 / 等人工审核 / 真崩了
# 三者在日志里长得几乎一样，必须靠内容区分。
check_round() {
  local round pending
  [[ -f "$SYNC_LOG" ]] || { RES_round="unknown"; DET_round="sync.log 不存在"; return 0; }
  round=$(awk '/^=== 同步开始/ {buf=""} {buf = buf $0 "\n"} END {printf "%s", buf}' "$SYNC_LOG" 2>/dev/null || true)
  [[ -n "$round" ]] || { RES_round="unknown"; DET_round="读不到最后一轮"; return 0; }
  if printf '%s\n' "$round" | grep -q '^=== 同步结束'; then
    RES_round="ok"; DET_round="上一轮正常结束"
    return 0
  fi
  pending=$(printf '%s\n' "$round" | grep -c '^待审核：' || true)
  if (( pending > 0 )); then
    # 待审稿是设计内的闸门，不是故障
    RES_round="warn"; DET_round="${pending} 篇待人工审核"
  else
    RES_round="fail"
    DET_round="上一轮没有结束标记；最近错误：$(tail -1 "$ERROR_LOG" 2>/dev/null | tr -d '\n' | cut -c1-100 || true)"
  fi
  return 0
}

# C3 凭据：有效性 + 有没有写权限 + 什么时候过期
# 仓库是公开的 —— 匿名请求也返回 200。所以必须断言 permissions.push == true，
# 否则「只能读不能写」的 token 会伪装成健康。
check_credential() {
  local token code body push expire headers exp_epoch days_left
  run_timeout 20 ${=CRED_HELPER} <<'PROTO' || true
protocol=https
host=github.com

PROTO
  token=$(printf '%s\n' "$OUT" | sed -n 's/^password=//p' | head -1)
  if [[ -z "$token" ]]; then
    RES_cred="fail"; DET_cred="钥匙串里取不到 GitHub 凭据（git credential helper 无输出）"
    return 0
  fi
  headers=$(curl -s -D - -o /dev/null --max-time "$CURL_MAX_TIME" \
    -H "Authorization: Bearer $token" "$API" 2>/dev/null || true)
  code=$(printf '%s\n' "$headers" | awk '/^HTTP\// {c=$2} END {print c+0}')
  if [[ "$code" != "200" ]]; then
    if [[ "$code" == "401" || "$code" == "403" ]]; then
      RES_cred="fail"; DET_cred="凭据被拒（HTTP $code），token 已失效或被吊销"
    else
      RES_cred="unstable"; DET_cred="GitHub API 无响应（HTTP $code），网络问题不是 token 的问题"
    fi
    return 0
  fi
  body=$(curl -s --max-time "$CURL_MAX_TIME" -H "Authorization: Bearer $token" "$API" 2>/dev/null || true)
  # GitHub 返回的是美化过的 JSON（跨行），先压成一行再取 permissions 块。
  # permissions 对象是扁平的，用 [^}]* 匹配到第一个 } 即可。
  perm=$(printf '%s' "$body" | tr -d '\n' | grep -o -E '"permissions":[[:space:]]*\{[^}]*\}' | head -1 || true)
  push=$(printf '%s' "$perm" | grep -o -E '"push":[[:space:]]*(true|false)' | head -1 | sed -E 's/.*(true|false)/\1/' || true)
  if [[ "$push" == "false" ]]; then
    RES_cred="fail"; DET_cred="能认证，但对仓库没有写权限（permissions.push=false）"
    return 0
  elif [[ "$push" != "true" ]]; then
    # 解析不出来 ≠ 没有权限。判 unknown，避免解析出问题就报假警。
    RES_cred="unknown"; DET_cred="能认证，但读不出 permissions.push（无法确认写权限）"
    return 0
  fi
  expire=$(printf '%s\n' "$headers" | awk -F': ' 'tolower($1)=="github-authentication-token-expiration" {print $2}' | tr -d '\r')
  if [[ -n "$expire" ]]; then
    exp_epoch=$(date -j -u -f "%Y-%m-%d %H:%M:%S" "${expire% UTC}" +%s 2>/dev/null || echo "")
    if [[ -n "$exp_epoch" ]]; then
      days_left=$(( (exp_epoch - now_epoch) / 86400 ))
      if (( days_left <= TOKEN_WARN_DAYS )); then
        RES_cred="warn"; DET_cred="凭据有效，但 ${days_left} 天后过期（$expire）"
        return 0
      fi
      DET_cred="凭据有效且可写，$expire 过期"
    else
      DET_cred="凭据有效且可写（过期时间无法解析：$expire）"
    fi
  else
    DET_cred="凭据有效且可写，无过期时间"
  fi
  return 0
}

# C4 本地 HEAD 与远端 main 是否一致
# 这是「内容到底推上去了没有」的直接指纹，比解析日志准得多，也不受代理抖动影响
# （走的是稳定的 api.github.com）。
check_remote() {
  local local_sha remote_sha
  local_sha=$(git rev-parse HEAD 2>/dev/null || echo "")
  [[ -n "$local_sha" ]] || { RES_remote="unknown"; DET_remote="读不到本地 HEAD"; return 0; }
  remote_sha=$(curl -s --max-time "$CURL_MAX_TIME" "$API/commits/main" 2>/dev/null \
    | sed -n 's/.*"sha": *"\([0-9a-f]\{40\}\)".*/\1/p' | head -1 || true)
  [[ -n "$remote_sha" ]] || { RES_remote="unknown"; DET_remote="读不到远端 main"; return 0; }
  if [[ "$local_sha" == "$remote_sha" ]]; then
    RES_remote="ok"; DET_remote="本地与远端一致（${local_sha[1,7]}）"
  else
    RES_remote="fail"; DET_remote="有内容没推上去：本地 ${local_sha[1,7]} ≠ 远端 ${remote_sha[1,7]}"
  fi
  return 0
}

# C5 推送链路（和真实 push 同一条代码路径：同一份代理配置、同一个 TLS 栈）
# 注意：公开仓库的 ls-remote 不需要认证，所以它只能验「链路」，验不了「凭据」。
check_chain() {
  if run_timeout 45 git ls-remote origin HEAD; then
    RES_chain="ok"; DET_chain="推送路径可用"
  else
    RES_chain="unstable"; DET_chain="连不上 github.com（代理没开或链路被干扰）"
  fi
  return 0
}

# C6 代理端口可达性。代理地址从 git 配置里读，不硬编码端口。
check_proxy() {
  local proxy rest host port
  proxy=$(git config --get http.https://github.com.proxy 2>/dev/null || true)
  if [[ -z "$proxy" ]]; then
    RES_proxy="ok"; DET_proxy="未配置 github.com 代理（走直连）"
    return 0
  fi
  rest="${proxy#*://}"
  rest="${rest%%/*}"
  host="${rest%%:*}"
  port="${rest##*:}"
  if [[ "$port" == "$host" ]]; then port="80"; fi
  if nc -z -w 3 "$host" "$port" >/dev/null 2>&1; then
    RES_proxy="ok"; DET_proxy="代理可达（$host:$port）"
  else
    RES_proxy="fail"; DET_proxy="代理不通（$host:$port），GitHub 连不上"
  fi
  return 0
}

# C7 线上内容与本地是否一致
# 站点 200 只说明 CDN 可达，不代表部署成功。这一项比 200 有用得多：
# push 成功但 CI 挂了 / 部署失败，它会抓到。
check_site() {
  local sitemap id missing=() total=0
  sitemap=$(curl -s --max-time "$CURL_MAX_TIME" "$SITE_URL/sitemap.xml" 2>/dev/null || true)
  if [[ -z "$sitemap" ]]; then
    RES_site="unknown"; DET_site="取不到线上 sitemap"
    return 0
  fi
  for f in content/entries/*.md(N); do
    id="${f:t:r}"
    total=$(( total + 1 ))
    if ! printf '%s' "$sitemap" | grep -q "$id"; then missing+=("$id"); fi
  done
  if (( ${#missing} )); then
    RES_site="fail"; DET_site="线上少了 ${#missing}/${total} 篇：${(j:, :)missing}"
  else
    RES_site="ok"; DET_site="线上 ${total} 篇全部与本地一致"
  fi
  return 0
}

# C8 站点存活
check_live() {
  local http
  http=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$CURL_MAX_TIME" "$SITE_URL/" 2>/dev/null) || http="000"
  if [[ "$http" == "200" ]]; then
    RES_live="ok"; DET_live="线上可达"
  else
    RES_live="fail"; DET_live="线上返回 HTTP $http"
  fi
  return 0
}

# C9 待审稿数量（信息项，不算故障）
check_pending() {
  local out
  command -v node >/dev/null 2>&1 || return 0
  out=$(node scripts/content.mjs status 2>/dev/null || true)
  PENDING=$(printf '%s\n' "$out" | grep -c '^待审核：' || true)
  return 0
}

check_alive
check_round
check_credential
check_remote
check_chain
check_proxy
check_site
check_live
check_pending

# ---------------------------------------------------------------- 休眠与卡死
# launchd 的定时任务在休眠期间不跑，唤醒后补跑 —— 这期间 sync.log 必然陈旧。
# 但如果 sync.log 在我们缺席期间还在前进，说明机器是醒的，是守护自己卡死了 —— 那要报。
SLEPT=0
FIRST_RUN=0
if [[ -n "$last_run_epoch" ]]; then
  gap_min=$(( (now_epoch - last_run_epoch) / 60 ))
  if (( gap_min > SLEEP_GRACE_MIN )); then
    last_start=$(grep -E '^=== 同步开始' "$SYNC_LOG" 2>/dev/null | tail -1 | sed -E 's/^=== 同步开始 ([0-9-]+ [0-9:]+).*/\1/' || true)
    last_start_epoch=$(local_to_epoch "$last_start" || echo "")
    if [[ -n "$last_start_epoch" ]] && (( last_start_epoch > last_run_epoch )); then
      RES_alive="fail"; DET_alive="守护任务自身卡住了 ${gap_min} 分钟（同期同步任务还在正常跑）"
    else
      SLEPT=1
      RES_alive="ok"; DET_alive="Mac 休眠过 ${gap_min} 分钟，本轮不判任务存活"
    fi
  fi
else
  # 首次运行：没有基线可比，但不代表机器睡过。
  # 这两种情况对「连续失败计数」的处理必须分开 —— 把首次运行当成休眠，
  # 会把第一轮真实的链路故障从计数里抹掉，等于少了一轮观测。
  FIRST_RUN=1
  RES_alive="ok"; DET_alive="首次运行，不判任务存活"
fi

# ---------------------------------------------------------------- 汇总

# 逐项维护「连续失败轮数」。连续 FAIL_STREAK 轮都坏才判定为故障（抗抖动）。
ITEMS=(alive round cred remote proxy site live)
streak_alive=0; streak_round=0; streak_cred=0; streak_remote=0
streak_proxy=0; streak_site=0; streak_live=0
for item in $ITEMS; do
  eval "res=\$RES_$item"
  key="streak_$item"
  streak=$(state_get "$key" "0")
  [[ "$streak" =~ ^[0-9]+$ ]] || streak=0
  if [[ "$res" == "fail" ]]; then
    streak=$(( streak + 1 ))
    if (( SLEPT )); then streak=0; fi     # 休眠期间留下的失败不算数
  else
    streak=0
  fi
  eval "$key=$streak"
done

# 链路不稳单独计数：连续 UNSTABLE_ROUNDS 轮不通才算故障
chain_streak=$(state_get streak_chain "0")
[[ "$chain_streak" =~ ^[0-9]+$ ]] || chain_streak=0
if [[ "$RES_chain" == "unstable" ]]; then
  chain_streak=$(( chain_streak + 1 ))
  if (( SLEPT )); then chain_streak=0; fi
else
  chain_streak=0
fi
if (( chain_streak >= UNSTABLE_ROUNDS )); then
  RES_chain="fail"; DET_chain="连续 ${chain_streak} 轮连不上 github.com"
fi

# 收集故障项。集合 + 指纹 —— 第二个故障不会被第一个吞掉。
# IMMEDIATE_ITEMS 是确定性状态（凭据被拒、代理拒连）：不会自己好，
# 等两轮只是在拖延告知，所以不走 streak 规则，直接进故障集合。
IMMEDIATE_ITEMS=(cred proxy)
FAILURES=()
for item in $ITEMS; do
  eval "res=\$RES_$item; det=\$DET_$item; streak=\${streak_$item}"
  if [[ "$res" != "fail" ]]; then
    continue
  fi
  immediate=0
  for imm in $IMMEDIATE_ITEMS; do
    if [[ "$item" == "$imm" ]]; then immediate=1; fi
  done
  if (( immediate )) || (( streak >= FAIL_STREAK )); then
    FAILURES+=("${item}:${det}")
  fi
done
if [[ "$RES_chain" == "fail" ]]; then
  FAILURES+=("chain:${DET_chain}")
fi

# 待审稿是信息项，不进故障集合
if (( PENDING > 0 )); then
  PENDING_MSG="$PENDING 篇待人工审核，自动发布已暂停"
else
  PENDING_MSG=""
fi

if (( ${#FAILURES} )); then
  FINGERPRINT=$(printf '%s\n' "${FAILURES[@]}" | sort | shasum | cut -c1-12)
else
  FINGERPRINT=""
fi

# ---------------------------------------------------------------- 通知

notified_fp=$(state_get notifiedFingerprint "")
notified_at=$(state_get notifiedAt "")
notified_epoch=$(iso_to_epoch "$notified_at" || echo "")

SHOULD_NOTIFY=0
NOTIFY_TITLE=""
NOTIFY_BODY=""
NOTIFY_SUB=""
NOTIFY_KIND=""

if (( ${#FAILURES} )); then
  NOTIFY_KIND="problem"
  NOTIFY_TITLE="日记发布守护 · 异常"
  NOTIFY_BODY="$(printf '%s' "${FAILURES[@]}" | sed 's/:/：/' | tr '\n' '；')"
  NOTIFY_SUB="排查：tail -30 $ERROR_LOG"
  if [[ "$FINGERPRINT" != "$notified_fp" ]]; then
    SHOULD_NOTIFY=1
  elif [[ -z "$notified_epoch" ]] || (( (now_epoch - notified_epoch) > REMIND_HOURS * 3600 )); then
    SHOULD_NOTIFY=1     # 同一组故障持续很久，补一次提醒
  fi
elif [[ -n "$PENDING_MSG" ]]; then
  NOTIFY_KIND="pending"
  NOTIFY_TITLE="日记发布守护 · 待处理"
  NOTIFY_BODY="$PENDING_MSG"
  NOTIFY_SUB="查看：cd $SITE_DIR && node scripts/content.mjs status"
  if [[ "$notified_fp" != "pending:$PENDING" ]]; then
    SHOULD_NOTIFY=1     # 待审数量变了才提示，避免反复刷屏
  fi
else
  if [[ -n "$notified_fp" ]]; then
    NOTIFY_KIND="recovery"
    NOTIFY_TITLE="日记发布守护 · 已恢复"
    NOTIFY_BODY="全部检查恢复正常"
    NOTIFY_SUB="上次异常：$notified_fp"
    SHOULD_NOTIFY=1
  fi
fi

# 冷却：上一条通知刚发过就跳过，避免手动连跑造成重复打扰。恢复通知不受冷却限制。
if (( SHOULD_NOTIFY )) && [[ "$NOTIFY_KIND" != "recovery" ]] && [[ -n "$notified_epoch" ]] \
   && (( (now_epoch - notified_epoch) < NOTIFY_COOLDOWN_MIN * 60 )); then
  SHOULD_NOTIFY=0
  log "距上次通知不足 ${NOTIFY_COOLDOWN_MIN} 分钟，本轮不打扰"
fi

if (( FORCE_NOTIFY )); then
  SHOULD_NOTIFY=1
  NOTIFY_KIND="test"
  NOTIFY_TITLE="${NOTIFY_TITLE:-日记发布守护}"
  NOTIFY_BODY="${NOTIFY_BODY:-这是一条测试通知}"
  NOTIFY_SUB="${NOTIFY_SUB:-来自 publish-watchdog}"
fi

if (( SHOULD_NOTIFY )); then
  if (( QUIET )); then
    log "（--quiet）本应通知但不发出：$NOTIFY_TITLE · $NOTIFY_BODY"
  else
    notify "$NOTIFY_TITLE" "$NOTIFY_BODY" "$NOTIFY_SUB" || true
  fi
  notified_fp="$FINGERPRINT"
  if [[ -n "$PENDING_MSG" ]]; then notified_fp="pending:$PENDING"; fi
  notified_at="$now_iso"
fi

# ---------------------------------------------------------------- 写状态（原子写）

tmp_state="$STATE_FILE.tmp.$$"
{
  echo "lastRunAt=$now_iso"
  echo "notifiedFingerprint=$notified_fp"
  echo "notifiedAt=$notified_at"
  echo "streak_chain=$chain_streak"
  echo "pendingCount=$PENDING"
  echo "fingerprint=$FINGERPRINT"
  echo "streak_alive=$streak_alive"
  echo "streak_round=$streak_round"
  echo "streak_cred=$streak_cred"
  echo "streak_remote=$streak_remote"
  echo "streak_proxy=$streak_proxy"
  echo "streak_site=$streak_site"
  echo "streak_live=$streak_live"
} > "$tmp_state"
mv -f "$tmp_state" "$STATE_FILE"

log "存活=$RES_alive | 上一轮=$RES_round | 凭据=$RES_cred | 远端=$RES_remote | 链路=$RES_chain | 代理=$RES_proxy | 线上=$RES_site | 站点=$RES_live | 待审=$PENDING"
log "  ${DET_alive}；${DET_round}；${DET_cred}；${DET_remote}；${DET_chain}；${DET_proxy}；${DET_site}；${DET_live}"
if (( ${#FAILURES} )); then
  log "故障项：${(j:, :)FAILURES}"
  exit 1
fi
exit 0
