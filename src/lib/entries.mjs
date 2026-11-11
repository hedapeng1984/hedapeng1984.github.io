import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { assertApproved } from '../../scripts/content-lib.mjs';

export function getEntries() {
  const root = path.join(process.cwd(), 'content');
  const reviews = JSON.parse(fs.readFileSync(path.join(root, 'reviews.json'), 'utf8'));
  return fs.readdirSync(path.join(root, 'entries')).filter(name => name.endsWith('.md')).map(name => {
    const id = name.slice(0, -3);
    const entry = assertApproved(fs.readFileSync(path.join(root, 'entries', name), 'utf8'), reviews[id], id);
    return { ...entry, html: marked.parse(entry.body), words: entry.body.replace(/\s/g, '').length };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export const prettyDate = date => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
