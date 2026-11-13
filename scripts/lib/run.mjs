// 跑外部命令的公共封装。
//
// 单独成文件是为了能直接对它做单元测试 —— sync.mjs 一导入就会跑整条发布流水线，
// 想验证「推送重试」的行为就只能靠真的推一次，风险太大。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// retry 选项只给推送用。
//
// 为什么推送要重试而别的命令不要：Geph 出口到 github.com 会被成片地 TLS RST
// （实测一个窗口里 3 次挂 1 次、紧接着另一个窗口 10 次全通）—— 单次失败是常态。
// 3s / 6s / 9s 递增间隔重试，把单轮成功率从约 67% 提到约 96%。
// 其他命令失败都是确定性状态（待审稿、构建报错、缺 node），重试只是把错误拖晚。
//
// 重试是安全的：push 失败不会改动本地 refs；如果失败其实发生在服务端已接收之后，
// 重试会得到 "Everything up-to-date"，判成功。
export function run(command, args, { allowOne = false, allowFail = false, capture = false, retry = 0, retryDelayMs = 3000 } = {}) {
  const env = { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' };
  const attempts = retry > 0 ? retry : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(command, args, { cwd: site, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', windowsHide: true, env });
    if (result.error) throw new Error(`${command} 无法执行：${result.error.message}`);
    const failed = result.status !== 0 && !(allowOne && result.status === 1);
    if (!failed) return capture ? result.stdout.trim() : result.status;
    if (allowFail) return capture ? (result.stdout || '').trim() : result.status;
    if (attempt < attempts) {
      const wait = retryDelayMs * attempt;
      console.log(`${command} 第 ${attempt} 次失败（退出码 ${result.status}），${wait / 1000} 秒后重试。`);
      // 同步等待：整条流水线是全同步的，不能用 async。Atomics.wait 在主线程里能真睡。
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
      continue;
    }
    throw new Error(`${command} 失败，已停止同步。`);
  }
  return 1;
}
