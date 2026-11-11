import { getEntries } from '../lib/entries.mjs';
import { site, articleUrl } from '../lib/site.mjs';
export const dynamic = 'force-static';
export default function sitemap() { return ['/', '/journal/', '/notes/', '/archive/', '/about/', ...getEntries().map(articleUrl)].map(route => ({ url: site.url + route })); }
