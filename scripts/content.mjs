import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertApproved, digest, parseEntry, redactEntry } from './content-lib.mjs';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateRoot = path.resolve(process.env.DIARY_PRIVATE_DIR || path.join(site, '../private'));
const reviewDir = path.join(privateRoot, 'review');
const entriesDir = path.join(site, 'content/entries');
const manifestPath = path.join(site, 'content/reviews.json');
const readManifest = async () => JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '{}';
  throw error;
}));
const mdNames = async dir => (await fs.readdir(dir).catch(error => {
  if (error.code === 'ENOENT') return [];
  throw error;
})).filter(name => name.endsWith('.md')).sort();

async function prepare() {
  const rules = JSON.parse(await fs.readFile(path.join(privateRoot, 'privacy-rules.json'), 'utf8'));
  const names = await mdNames(path.join(privateRoot, 'originals'));
  if (!names.length) throw new Error('没有找到原稿；不会自动删除任何已发布日记。');
  await fs.mkdir(reviewDir, { recursive: true });
  const seen = new Set();
  for (const name of names) {
    const output = redactEntry(await fs.readFile(path.join(privateRoot, 'originals', name), 'utf8'), rules);
    const id = parseEntry(output).id;
    if (seen.has(id)) throw new Error('存在重复日记 id。');
    seen.add(id);
    const candidate = path.join(reviewDir, `${id}.md`);
    const existing = await fs.readFile(candidate, 'utf8').catch(() => null);
    // 不覆盖人工编辑的待审稿。原稿变动后先报告差异，要求人工决定如何合并。
    const generatedPath = path.join(reviewDir, `${id}.generated.sha256`);
    const previousGenerated = (await fs.readFile(generatedPath, 'utf8').catch(() => '')).trim();
    const nextGenerated = digest(output);
    if (existing && previousGenerated && digest(existing) !== previousGenerated) {
      if (previousGenerated !== nextGenerated) {
        throw new Error(`${id}：原稿和人工公开稿均有修改，请先人工合并；现有公开稿未覆盖。`);
      }
    } else {
      await fs.writeFile(candidate, output);
    }
    await fs.writeFile(generatedPath, nextGenerated + '\n');
    console.log(`已准备待审稿：${id}`);
  }
}

async function approve(id) {
  if (!process.argv.includes('--i-reviewed-fictional-content') && !process.argv.includes('--i-reviewed-content')) throw new Error('请先阅读待审稿，确认后使用 --i-reviewed-content。');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? '')) throw new Error('请提供有效 id。');
  const text = await fs.readFile(path.join(reviewDir, `${id}.md`), 'utf8');
  if (process.argv.includes('--i-reviewed-fictional-content') && parseEntry(text).demo !== true) throw new Error('真实学习笔记不能使用虚构内容确认标记。');
  assertApproved(text, { sha256: digest(text) }, id);
  await fs.mkdir(entriesDir, { recursive: true });
  await fs.writeFile(path.join(entriesDir, `${id}.md`), text);
  const manifest = await readManifest();
  manifest[id] = { sha256: digest(text), approvedAt: new Date().toISOString(), fictional: parseEntry(text).demo };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`已确认公开稿：${id}`);
}

async function check() {
  const manifest = await readManifest();
  const names = await mdNames(entriesDir);
  if (!names.length) throw new Error('没有已审核的公开稿。');
  for (const name of names) {
    const id = name.slice(0, -3);
    assertApproved(await fs.readFile(path.join(entriesDir, name), 'utf8'), manifest[id], id);
  }
  const ids = new Set(names.map(name => name.slice(0, -3)));
  if (Object.keys(manifest).some(id => !ids.has(id))) throw new Error('审核记录与文章文件不一致；删除文章时需一并移除审核记录。');
  const publicFiles = await fs.readdir(path.join(site, 'public'));
  if (publicFiles.some(name => !['CNAME', 'robots.txt', 'favicon.svg', '.nojekyll'].includes(name))) throw new Error('public 目录出现未经审核的额外资源。');
  console.log(`审核校验通过：${names.length} 篇公开稿。`);
}

async function status() {
  const manifest = await readManifest();
  let pending = 0;
  for (const name of await mdNames(reviewDir)) {
    const id = name.slice(0, -3);
    const text = await fs.readFile(path.join(reviewDir, name), 'utf8');
    const approved = manifest[id]?.sha256 === digest(text);
    console.log(`${approved ? '已审核' : '待审核'}：${id}`);
    if (!approved) pending++;
  }
  if (pending && process.argv.includes('--fail-on-pending')) throw new Error(`${pending} 篇待审核，暂不自动推送。`);
}

try {
  const [command, id] = process.argv.slice(2);
  if (command === 'prepare') await prepare();
  else if (command === 'approve') await approve(id);
  else if (command === 'check') await check();
  else if (command === 'status') await status();
  else throw new Error('用法：content.mjs prepare | approve <id> | status | check');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
