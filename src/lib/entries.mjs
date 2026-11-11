import fs from 'node:fs';
import path from 'node:path';
import { assertApproved } from '../../scripts/content-lib.mjs';
import { entryKind } from './site.mjs';
import { plainText, readingStats, renderMarkdown } from './markdown.mjs';

export function getEntries() {
  const root = path.join(process.cwd(), 'content');
  const reviews = JSON.parse(fs.readFileSync(path.join(root, 'reviews.json'), 'utf8'));
  return fs.readdirSync(path.join(root, 'entries')).filter(name => name.endsWith('.md')).map(name => {
    const id = name.slice(0, -3);
    const entry = assertApproved(fs.readFileSync(path.join(root, 'entries', name), 'utf8'), reviews[id], id);
    return { ...entry, ...renderMarkdown(entry.body), ...readingStats(entry.body), kind: entryKind(entry), searchText: plainText(entry.body) };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function listEntries(entries) {
  return entries.map(({ id, title, date, summary, tags, demo, kind, words, minutes, searchText }) => ({ id, title, date, summary, tags, demo, kind, words, minutes, searchText }));
}
