import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, readingStats } from '../src/lib/markdown.mjs';
import { entryKind } from '../src/lib/site.mjs';
import { redactEntry, parseEntry } from '../scripts/content-lib.mjs';

test('重复标题生成独立目录链接，正文表格保留可滚动结构', () => {
  const { html, headings } = renderMarkdown('## 同一个标题\n\n内容\n\n## 同一个标题\n\n| 项目 | 内容 |\n| --- | --- |\n| 甲 | 乙 |');
  assert.equal(headings.length, 2);
  assert.notEqual(headings[0].id, headings[1].id);
  for (const item of headings) assert.ok(html.includes(`id="${item.id}"`));
  assert.ok(html.includes('class="table-scroll"'));
  assert.ok(html.includes('<table>'));
});
test('兼容旧笔记，新日记不会因健康等主题被误归类', () => {
  assert.equal(entryKind({ id: 'musk-thinking' }), 'note');
  assert.equal(entryKind({ id: 'cancer-learning-notes' }), 'note');
  assert.equal(entryKind({ id: 'future-journal', tags: ['健康'], demo: false }), 'journal');
  assert.equal(entryKind({ id: 'future-note', kind: 'note' }), 'note');
});
test('中文阅读计数包含汉字与英文词，忽略 Markdown 标记', () => {
  assert.equal(readingStats('## 你好\n\n**世界** Next.js').words, 6);
});
test('新笔记的 kind 元信息可以通过脱敏流程，未知分类拒绝', () => {
  const text = '---\nid: new-note\ntitle: 一页笔记\ndate: 2026-11-11\ntags: [阅读]\nsummary: 阅读后的想法\nkind: note\n---\n\n正文。\n';
  assert.equal(parseEntry(redactEntry(text, { replacements: {} })).kind, 'note');
  assert.throws(() => redactEntry(text.replace('kind: note', 'kind: unknown'), {}));
});
