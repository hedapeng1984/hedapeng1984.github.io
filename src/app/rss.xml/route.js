import { getEntries } from '../../lib/entries.mjs';
import { site, articleUrl } from '../../lib/site.mjs';
export const dynamic = 'force-static';
const escape = value => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
export function GET() {
  const items = getEntries().map(entry => `<item><title>${escape(entry.title)}</title><link>${site.url}${articleUrl(entry)}</link><guid>${site.url}${articleUrl(entry)}</guid><pubDate>${new Date(entry.date + 'T00:00:00+08:00').toUTCString()}</pubDate><description>${escape(entry.summary)}</description></item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${site.name}</title><link>${site.url}</link><description>${site.description}</description><language>zh-CN</language><atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
