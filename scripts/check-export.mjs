import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEntries } from '../src/lib/entries.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(siteRoot, 'out');
await fs.writeFile(path.join(output, '.nojekyll'), '');
const fontLicenses = [];
for (const font of ['newsreader', 'noto-serif-sc']) {
  fontLicenses.push(`=== ${font} ===\n` + await fs.readFile(path.join(siteRoot, 'node_modules/@fontsource-variable', font, 'LICENSE'), 'utf8'));
}
await fs.writeFile(path.join(output, 'font-licenses.txt'), fontLicenses.join('\n\n'));
const expected = ['index.html', '404.html', 'journal/index.html', 'notes/index.html', 'archive/index.html', 'about/index.html', 'rss.xml', 'sitemap.xml', ...getEntries().map(entry => `diary/${entry.id}/index.html`)];
for (const name of expected) await fs.access(path.join(output, name));
const cname = (await fs.readFile(path.join(output, 'CNAME'), 'utf8')).trim();
if (cname !== 'hedapeng.com') throw new Error('导出目录域名配置不符。');
async function checkDirectory(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name);
    if (['private', 'originals', 'review', 'content'].includes(item.name) || /\.md$|\.map$|^\.env|privacy-rules|reviews\.json/i.test(item.name)) throw new Error('导出目录包含不应公开的文件：' + target);
    if (item.isDirectory()) await checkDirectory(target);
  }
}
await checkDirectory(output);
console.log(`静态导出校验通过：${getEntries().length} 篇文章、原网址、RSS、域名与 GitHub Pages 资源目录。`);
