import { getEntries } from '../lib/entries.mjs';
import { site, articleUrl } from '../lib/site.mjs';
export const dynamic = 'force-static';
export default function sitemap() {
  const pages = ['/', '/journal/', '/notes/', '/archive/', '/about/'].map(route => ({ url: site.url + route }));
  // 文章带 lastModified（用稿件日期）；栏目页不写 —— 写一个每次构建都变的时间，
  // 只会让 Google 以为页面天天在改。
  for (const entry of getEntries()) pages.push({ url: site.url + articleUrl(entry), lastModified: new Date(entry.date) });
  return pages;
}
