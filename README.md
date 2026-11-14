# 生长

基于 Next.js App Router 的 Markdown 日记网站，以李笑来官网的留白、衬线字、细分隔线和蓝红点色为审美参考，独立实现中文排版。当前为**七篇文章**：一篇虚构日记，以及六篇笔记。虚构内容与笔记分开标注。

网址：https://www.hedapeng.com

## 开发

需要 Node.js 22.12+，建议使用 LTS。

```sh
npm ci
npm run dev
```

## 验证与构建

```sh
npm test
npm run build
npm run preview
```

只有 `content/entries/` 中已审核且 SHA-256 匹配的稿件才能构建。代码仓库不保存真实私人原稿或化名对应表。发布目录只接收已审核的公开文字；保留公开 HTTPS 来源，暂不接收图片、本地附件或 HTML。

Next.js 使用 `output: 'export'` 与 `trailingSlash: true`，构建产物为 `out/`。推送 main 后由 GitHub Actions 自动构建并发布到 GitHub Pages。自定义域名为 www.hedapeng.com，不需要租用服务器或运行 Node.js 服务。

保留 `/diary/<id>/` 原网址。网站含日记、笔记、全文搜索、主题筛选、归档、文章目录、阅读进度、四态主题（跟随系统 / 浅色 / 暖纸 / 深色）、构建期代码高亮、打印样式和 RSS。中文正文桌面 18px、手机 17px，最大宽度 680px，表格可横向滚动。中英文字体随站点托管，开源许可见 `/font-licenses.txt`。

新文章默认分类为日记；新笔记在原稿 YAML 中设置 `kind: note`，日记可设置 `kind: journal`。分类修改与正文修改一样需要重新审核，早期几篇笔记兼容原有格式。

## 排版刻度

所有字号、间距、行高、字距与颜色都收在 `src/app/tokens.css`，`globals.css` 只引用变量。改版式时改 token 层，不要在组件里写死数值。

- **颜色**一律用 `oklch()`。纸墨的 chroma 只有 0.003 左右（几乎无彩），只有强调色放到 0.12 以上；深色是同一批色的反相，色相不变，所以明暗切换不偏色。另有第三档「暖纸」，把整批色的色温从冷调换到暖调。
- **字号与间距**按具体场景定值，不做比例尺：需要 21px 就是 `--fs-21`，不需要从 16px 推导 scale。这样每个场景都有名字，也避免改一处牵动全局。
- **行宽**优先用 `em`（一个汉字 = 1em），改字号时"每行多少字"自动不变；但需要和相邻区块对齐的地方（正文栏与目录框）必须用 `px`，否则两边按各自字号算出不同宽度会错位。
- **中文排版**单独一组变量：`--cjk-track-body` 给正文加字距，`--cjk-track-display` 给大标题用，`--cjk-gap` 管中英混排间距；强调用点线着重号而不是斜体，斜体对汉字是失真的。
- 代码高亮在构建期完成（`src/lib/markdown.mjs`），只认字符串、注释、数字和关键字四类，浏览器端零 JS，也不引入额外依赖。

## 改版前备份与回退

旧版基准提交为 `c59bfa202f7cb45c3b7a3f80a12aec398ab07925`，远端保留标签 `backup/pre-redesign-2026-11-11`。回退网站和发布脚本时，在干净工作目录从 main 创建恢复分支，将该标签的跟踪文件恢复后提交、审阅并合并 main；不要强制推送或直接清空历史。新版期间新增的公开文章需要单独保留并合并，防止恢复旧树时被移除。

## Mac 自动同步

脚本：`scripts/sync-macos.sh`（同步入口）、`scripts/sync-sources.mjs`（原稿同步）、`scripts/sync.mjs`（审核、构建、推送）；安装与卸载任务：`scripts/install-macos-agent.sh`、`scripts/uninstall-macos-agent.sh`。

原稿默认放在本仓库外的 `../private/originals/`，替换规则在 `../private/privacy-rules.json`，也可用环境变量 `DIARY_PRIVATE_DIR` 指定。没有原稿时构建现有网站不受影响，自动整理任务会停止。需要人工阅读待审稿并批准，才能自动推送内容。确认指令：`node scripts/content.mjs approve <id> --i-reviewed-content`。

原稿自己带 YAML 元信息（`id` / `title` / `date` / `tags` / `summary` / `kind` / `demo`）时直接用；**不带**的（剪藏、从公众号复制来的文章通常不带）在 `../private/meta.json` 里按文件名旁挂一份，键是原稿文件名。旁挂的这份必须写明 `demo`：`true` 是虚构内容，`false` 是真人真事 —— 这是「示例」和「真人真事」的分界线，猜错就把演示内容当真事发出去。

整理时还会顺手处理两类剪藏痕迹：指向本地、但文件并不存在的图片引用会被删掉（会报出删了几处），`<kbd>` `<b>` `<em>` `<code>` 这类内联标签会转成 Markdown；其余原始 HTML 仍然一律拒绝。

**待审稿挡住的是「内容发布」，不是「代码推送」**：待审稿在 `private/review/`，不会进 `content/entries`，所以审稿期间脚本修复照常推上线，线上文章保持原样不动。

### 脱敏规则

`../private/privacy-rules.json` 只有两段规则：

| 字段 | 写法 | 例子 |
|---|---|---|
| `names` | 人名全名，自动换成拼音首字母 | `"王小明"` → `WXM` |
| `alert` | 只提醒、不替换：列出要盯的字串和行号 | `"某某市某某路12号"` |

规则要点：

- **只出现姓氏不脱敏。** 单字条目一律忽略，所以「徐老师」「李总」这类称呼原样保留；名单里写 `陈` 不会误伤别人。
- **名单里没有的名字不替换，系统也不猜。** 中文里说明、和平、方向、马路都像人名，猜错的代价比漏掉的更大。漏登记的风险由审稿环节兜底。
- **`alert` 只报行号，不动正文。** 整理时列出命中的行，改法由你定：直接编辑 `../private/review/<id>.md` 里的待审稿（原稿不动），再 approve。要盯的字串由你写进清单 —— 系统不猜哪些字敏感，猜错的代价比漏掉的更大。

待审稿和已批准的公开稿对不上时（比如原稿改了、整理脚本又生成了一版新的待审稿），发布闸会一直关着。如果那一版你并不想要、只想保留早就批准过的那版，用 `node scripts/content.mjs reset-draft <id>` 退回；手工改过的待审稿不会被它覆盖。
- **拼音按单字取音**，不看上下文：多音字取常用读音（长 → Z，行 → X）。表由 macOS 自带的 ICU 离线生成，是静态数据文件，运行时不依赖第三方包。

### 原稿自动进站

Mac 上的 Markdown 原稿（印象笔记导出、Obsidian 仓库、iCloud 文件夹等）可以配成"源目录"，每次同步时自动进到 `private/originals/`。在仓库外的 `private/sources.json` 里配置：

```json
{
  "sources": ["~/Documents/日记原稿", "~/Sites/日记原稿"],
  "extensions": [".md"]
}
```

规则是**只新增、不静默覆盖**：内容一致直接跳过；内容不同会列出来等人决定，确认后用 `node scripts/sync-sources.mjs --force` 覆盖。源目录只读，绝不会被修改或删除。

### 安装后台任务

```sh
zsh scripts/install-macos-agent.sh
```

会检查 Node 版本、写一份 `sources.json` 模板、生成 LaunchAgent（每 5 分钟一次、登录后自启、日志在 `~/Library/Logs/hedapeng-journal/`）。任务里只写绝对路径，但 node 的实际位置由 `sync-macos.sh` 在运行时自己解析，所以用 nvm 换版本也不会失效。

任务只覆盖"登录用户"域：Mac 休眠、关机、退出登录时不保证运行，恢复后补跑。网站由 GitHub Pages 托管，不依赖这台 Mac 一直开机。卸载：`zsh scripts/uninstall-macos-agent.sh`（加 `--purge` 连配置和日志一起删）。

网页无统计、评论、外部字体或数据库。试刊结束后站点已开放搜索引擎收录：`src/lib/site.mjs` 里的 `trial` 改回 `true` 可一键恢复 noindex，`public/robots.txt` 负责放行抓取并指向 sitemap。收录本身不构成访问保护。

### 搜索引擎收录

收录要过两道闸，两道都得开：

1. **页面 meta** —— `src/lib/site.mjs` 的 `trial: false` 会让每页输出 `<meta name="robots" content="index, follow">`。
2. **robots.txt** —— `public/robots.txt` 写的是 `Allow: /` 并指向 sitemap。只改 meta 不改这个文件，爬虫在读到 meta 之前就被挡住了。

**站点所有权验证**：Google Search Console 的验证码填在 `src/lib/site.mjs` 的 `verification.google`，留空则不输出这个 meta 标签。这串验证码本来就要公开写在网页里，可以直接粘进聊天或代码。

**站点地图**：`https://www.hedapeng.com/sitemap.xml`（构建时生成，含首页、栏目页和全部文章）。在 Search Console 的「站点地图」里填这个地址即可。

⚠️ 根域 `hedapeng.com` 目前没有 DNS 记录，只有 `www.hedapeng.com` 可访问 —— 域名服务器在阿里云（dns9/dns10.hichina.com），需要加根域记录时在阿里云 DNS 控制台操作。
