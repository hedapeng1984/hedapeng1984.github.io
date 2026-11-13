import fs from 'node:fs';
import path from 'node:path';
import { run, site } from './lib/run.mjs';

const lockPath = path.join(site, '.cache/sync-lock.json');
const STALE_LOCK_MS = 30 * 60 * 1000;

fs.mkdirSync(path.dirname(lockPath), { recursive: true });
if (fs.existsSync(lockPath)) {
  const age = Date.now() - fs.statSync(lockPath).mtimeMs;
  if (age < STALE_LOCK_MS) {
    console.log('已有同步任务运行，本次跳过。若上次被强制结束，过 30 分钟后会自动清理残留锁。');
    process.exit(0);
  }
  console.log('发现上次残留的同步锁（已超过 30 分钟），已清理。');
}
fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));

try {
  const repositoryRoot = run('git', ['rev-parse', '--show-toplevel'], { capture: true });
  if (path.resolve(repositoryRoot).toLowerCase() !== site.toLowerCase()) throw new Error('Git 仓库根目录必须恰好是 site，防止上传相邻私人目录。');
  const branch = run('git', ['branch', '--show-current'], { capture: true });
  if (branch !== 'main') throw new Error('当前必须在 main 分支，请先人工处理分支。');
  if (run('git', ['diff', '--cached', '--quiet'], { allowOne: true }) !== 0) throw new Error('有其他已暂存改动，请先人工处理。');

  run(process.execPath, ['scripts/content.mjs', 'prepare']);
  // 有待审稿就到此为止：不构建、不提交、不推送，等人工读完 approve。
  run(process.execPath, ['scripts/content.mjs', 'status', '--fail-on-pending']);
  run(process.execPath, ['scripts/content.mjs', 'check']);

  // 拉取远端引用只为判断"有没有东西要推"，断网不算失败。
  run('git', ['fetch', '--quiet', 'origin', 'main'], { allowFail: true });
  const contentChanges = run('git', ['status', '--porcelain', '--', 'content'], { capture: true });
  const local = run('git', ['rev-parse', 'HEAD'], { capture: true, allowFail: true });
  const remote = run('git', ['rev-parse', 'origin/main'], { capture: true, allowFail: true });
  if (!contentChanges && local && remote && local === remote) {
    console.log('没有新内容，跳过构建与推送。');
  } else {
    run(process.execPath, ['scripts/next.mjs', 'build', '--webpack']);
    run(process.execPath, ['scripts/check-export.mjs']);
    run('git', ['add', '--', 'content/entries', 'content/reviews.json']);
    if (run('git', ['diff', '--cached', '--quiet'], { allowOne: true }) !== 0) {
      run('git', ['commit', '-m', 'Publish reviewed journal entries']);
    }
    // 总是尝试推送，补传上次断网留下的本地提交。
    // 推送会撞上链路干扰（Geph 出口被成片重置），所以本轮内重试 3 次。
    run('git', ['push', 'origin', 'HEAD:main'], { retry: 3 });
  }
  console.log(`最后成功同步：${new Date().toISOString()}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { fs.rmSync(lockPath, { force: true }); }
