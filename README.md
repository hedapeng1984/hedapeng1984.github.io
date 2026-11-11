# 大鹏的日记

一个极简 Markdown 日记网站。当前为**四篇文章试刊**：两篇虚构日记，以及两篇用户提供的学习笔记。虚构内容与学习笔记分开标注。

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
```

只有 `content/entries/` 中已审核且 SHA-256 匹配的稿件才能构建。代码仓库不保存真实私人原稿或化名对应表。发布目录只接收已审核的公开文字；保留公开 HTTPS 来源，暂不接收图片、本地附件或 HTML。

推送 main 后由 GitHub Actions 自动发布到 GitHub Pages。自定义域名为 www.hedapeng.com。

## Mac 自动同步

脚本：`scripts/sync-macos.sh`；安装任务：`scripts/install-macos-agent.sh`。

原稿默认放在本仓库外的 `../private/originals/`，替换规则在 `../private/privacy-rules.json`，也可用环境变量 `DIARY_PRIVATE_DIR` 指定。没有原稿时构建现有网站不受影响，自动整理任务会停止。需要人工阅读待审稿并批准，才能自动推送。确认指令：`node scripts/content.mjs approve <id> --i-reviewed-content`。

网页无统计、评论、外部字体或数据库。当前 noindex 仅为试刊搜索提示，不构成访问保护。
