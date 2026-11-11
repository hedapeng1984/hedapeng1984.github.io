# 大鹏的日记

基于 Next.js App Router 的 Markdown 日记网站，以李笑来官网的留白、衬线字、细分隔线和蓝红点色为审美参考，独立实现中文排版。当前为**四篇文章试刊**：两篇虚构日记，以及两篇用户提供的学习笔记。虚构内容与学习笔记分开标注。

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

保留 `/diary/<id>/` 原网址。网站含日记、笔记、全文搜索、主题筛选、归档、文章目录、阅读进度、三态主题和 RSS。中文正文桌面 18px、手机 17px，最大宽度 680px，表格可横向滚动。中英文字体随站点托管，开源许可见 `/font-licenses.txt`。

新文章默认分类为日记；新学习笔记在原稿 YAML 中设置 `kind: note`，日记可设置 `kind: journal`。分类修改与正文修改一样需要重新审核，首批两篇学习笔记兼容原有格式。

## 改版前备份与回退

旧版基准提交为 `c59bfa202f7cb45c3b7a3f80a12aec398ab07925`，远端保留标签 `backup/pre-redesign-2026-11-11`。回退网站和发布脚本时，在干净工作目录从 main 创建恢复分支，将该标签的跟踪文件恢复后提交、审阅并合并 main；不要强制推送或直接清空历史。新版期间新增的公开文章需要单独保留并合并，防止恢复旧树时被移除。

## Mac 自动同步

脚本：`scripts/sync-macos.sh`；安装任务：`scripts/install-macos-agent.sh`。

原稿默认放在本仓库外的 `../private/originals/`，替换规则在 `../private/privacy-rules.json`，也可用环境变量 `DIARY_PRIVATE_DIR` 指定。没有原稿时构建现有网站不受影响，自动整理任务会停止。需要人工阅读待审稿并批准，才能自动推送。确认指令：`node scripts/content.mjs approve <id> --i-reviewed-content`。

网页无统计、评论、外部字体或数据库。当前 noindex 仅为试刊搜索提示，不构成访问保护。
