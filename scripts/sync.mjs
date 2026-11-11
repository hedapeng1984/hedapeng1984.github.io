import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = path.join(site, '.cache/sync-lock');
fs.mkdirSync(path.dirname(lock), { recursive: true });
try { fs.mkdirSync(lock); } catch (error) {
  if (error.code === 'EEXIST') { console.log('已有同步任务运行。如上次被强制结束，请人工检查 .cache/sync-lock。'); process.exit(0); }
  throw error;
}
function run(command, args, { allowOne = false, capture = false } = {}) {
  const result = spawnSync(command, args, { cwd: site, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', windowsHide: true, env: { ...process.env, GCM_INTERACTIVE: 'never' } });
  if (result.error) throw new Error(`${command} 无法执行：${result.error.message}`);
  if (result.status !== 0 && !(allowOne && result.status === 1)) throw new Error(`${command} 失败，已停止同步。`);
  return capture ? result.stdout.trim() : result.status;
}
try {
  const repositoryRoot = run('git', ['rev-parse', '--show-toplevel'], { capture: true });
  if (path.resolve(repositoryRoot).toLowerCase() !== site.toLowerCase()) throw new Error('Git 仓库根目录必须恰好是 site，防止上传相邻私人目录。');
  const branch = run('git', ['branch', '--show-current'], { capture: true });
  if (branch !== 'main') throw new Error('当前必须在 main 分支，请先人工处理分支。');
  if (run('git', ['diff', '--cached', '--quiet'], { allowOne: true }) !== 0) throw new Error('有其他已暂存改动，请先人工处理。');
  run(process.execPath, ['scripts/content.mjs', 'prepare']);
  run(process.execPath, ['scripts/content.mjs', 'status', '--fail-on-pending']);
  run(process.execPath, ['scripts/content.mjs', 'check']);
  run(process.execPath, ['scripts/astro.mjs', 'build']);
  run('git', ['add', '--', 'content/entries', 'content/reviews.json']);
  if (run('git', ['diff', '--cached', '--quiet'], { allowOne: true }) !== 0) {
    run('git', ['commit', '-m', 'Publish reviewed journal entries']);
  }
  // 总是尝试推送，补传上次断网留下的本地提交。
  run('git', ['push', 'origin', 'HEAD:main']);
  console.log(`最后成功同步：${new Date().toISOString()}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { fs.rmdirSync(lock); }
