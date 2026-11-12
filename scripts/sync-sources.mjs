/**
 * 把 Mac 上的原稿源目录增量同步进 private/originals/。
 *
 * 原则（与整套发布流程的谨慎基调一致）：
 * 1. 只新增，不静默覆盖 —— 已存在但内容不同的原稿会被列出来，等人决定。
 * 2. 幂等 —— 内容一致直接跳过，不重复拷贝。
 * 3. 源目录缺失不报错 —— Mac 上 iCloud 未挂载等情况只提示，不中断同步。
 * 4. 只读源目录 —— 永远不修改、不删除源文件。
 *
 * 配置：private/sources.json（仓库外）
 *   {
 *     "sources": ["~/Documents/笔记/导出", "~/Sites/日记原稿"],
 *     "extensions": [".md"]
 *   }
 *
 * 用法：node scripts/sync-sources.mjs [--force]
 *   --force 会覆盖内容不同的已有原稿（改稿后再用，避免丢掉人工改动）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateRoot = path.resolve(process.env.DIARY_PRIVATE_DIR || path.join(site, '../private'));
const originalsDir = path.join(privateRoot, 'originals');
const configPath = path.join(privateRoot, 'sources.json');
const force = process.argv.includes('--force');
const DEFAULT_EXTENSIONS = ['.md'];

const digest = text => createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex');

function expandHome(target) {
  return target.startsWith('~') ? path.join(process.env.HOME || '', target.slice(1)) : target;
}

function readConfig() {
  if (!fs.existsSync(configPath)) {
    console.log('未找到原稿源配置，跳过原稿同步。');
    console.log(`  如需自动同步，请创建：${configPath}`);
    console.log('  格式：{"sources":["~/你的原稿目录"],"extensions":[".md"]}');
    return null;
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`原稿源配置无法解析（${configPath}）：${error.message}`);
  }
  const sources = Array.isArray(config.sources) ? config.sources : [];
  if (!sources.length) {
    console.log('原稿源配置里没有 sources，跳过原稿同步。');
    return null;
  }
  const extensions = (Array.isArray(config.extensions) && config.extensions.length ? config.extensions : DEFAULT_EXTENSIONS)
    .map(extension => (extension.startsWith('.') ? extension : `.${extension}`).toLowerCase());
  return { sources, extensions };
}

function collect(directory, extensions, found = []) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const target = path.join(directory, item.name);
    if (item.isDirectory()) collect(target, extensions, found);
    else if (extensions.includes(path.extname(item.name).toLowerCase())) found.push(target);
  }
  return found;
}

try {
  const config = readConfig();
  if (!config) process.exit(0);

  fs.mkdirSync(originalsDir, { recursive: true });
  let added = 0;
  let same = 0;
  const conflicting = [];

  for (const rawSource of config.sources) {
    const source = path.resolve(expandHome(String(rawSource)));
    if (!fs.existsSync(source)) {
      console.log(`源目录不存在，跳过：${source}`);
      continue;
    }
    if (!fs.statSync(source).isDirectory()) {
      console.log(`源目录不是文件夹，跳过：${source}`);
      continue;
    }
    for (const file of collect(source, config.extensions)) {
      const name = path.basename(file);
      const target = path.join(originalsDir, name);
      const text = fs.readFileSync(file, 'utf8');
      if (fs.existsSync(target)) {
        const existing = fs.readFileSync(target, 'utf8');
        if (digest(existing) === digest(text)) {
          same++;
          continue;
        }
        if (force) {
          fs.writeFileSync(target, text);
          console.log(`已覆盖（--force）：${name}`);
          added++;
        } else {
          conflicting.push(name);
        }
        continue;
      }
      fs.writeFileSync(target, text);
      console.log(`已新增原稿：${name}`);
      added++;
    }
  }

  if (conflicting.length) {
    console.log('\n以下原稿与源文件内容不同，已保留本地的版本，未自动覆盖：');
    for (const name of conflicting) console.log(`  ${name}`);
    console.log('  确认要以源文件为准时，运行：node scripts/sync-sources.mjs --force');
  }
  console.log(`原稿同步完成：新增或覆盖 ${added} 篇，内容一致 ${same} 篇，待人工确认 ${conflicting.length} 篇。`);
} catch (error) {
  console.error(`原稿同步失败：${error.message}`);
  process.exitCode = 1;
}
