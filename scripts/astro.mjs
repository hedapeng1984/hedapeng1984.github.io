import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 所有平台统一关闭框架遥测，不创建全局遥测配置。
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/astro/astro.js', import.meta.url)), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  windowsHide: true,
});
if (result.error) { console.error(result.error.message); process.exitCode = 1; }
else process.exitCode = result.status ?? 1;
