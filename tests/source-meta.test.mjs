import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeInlineHtml, parseEntry, redactEntry, stripMissingImages } from '../scripts/content-lib.mjs';

const meta = {
  id: 'plain-article',
  title: '一个单词开启一个洁净的网络世界',
  date: '2026-11-14',
  tags: ['专注力'],
  summary: '一篇剪藏来的文章。',
  kind: 'note',
  demo: false,
};

// 剪藏来的文章长这样：没有 YAML 元信息，标题在第一行，还夹着内联标签。
const plain = '# 一个单词开启一个洁净的网络世界\n\n正文第一段。\n\n输入<kbd>read：</kbd>，再按回车。\n';

test('没有 YAML 的原稿，用旁挂元信息也能整理成公开稿', () => {
  const entry = parseEntry(redactEntry(plain, {}, { meta }));
  assert.equal(entry.id, 'plain-article');
  assert.equal(entry.title, meta.title);
  assert.equal(entry.kind, 'note');
  assert.equal(entry.demo, false, '真人真事必须标成 demo: false');
});

test('正文开头和标题重复的那一行标题会被去掉', () => {
  const text = redactEntry(plain, {}, { meta });
  assert.ok(!text.includes('# 一个单词开启一个洁净的网络世界'));
  assert.ok(text.includes('正文第一段。'));
});

test('旁挂元信息必须写明必需字段和 demo', () => {
  assert.throws(() => redactEntry(plain, {}, { meta: { ...meta, demo: undefined } }), /demo/);
  assert.throws(() => redactEntry(plain, {}, { meta: { ...meta, id: '' } }), /缺少 id/);
  assert.throws(() => redactEntry(plain, {}, { meta: { ...meta, tags: '专注力' } }), /tags/);
  assert.throws(() => redactEntry(plain, {}, {}), /元信息/);
});

test('内联标签转成 Markdown，代码块和其余原始 HTML 不动', () => {
  assert.equal(normalizeInlineHtml('输入<kbd>read：</kbd>'), '输入`read：`');
  assert.equal(normalizeInlineHtml('<b>粗</b>与<em>斜</em>'), '**粗**与*斜*');
  assert.equal(normalizeInlineHtml('```\n<b>不改</b>\n```'), '```\n<b>不改</b>\n```');
  assert.throws(() => redactEntry(plain + '<script>alert(1)</script>', {}, { meta }), /原始 HTML/);
});

test('本地找不到的图片被删掉并报出来，本地存在的图片照旧拒绝', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const missing = stripMissingImages('![图](images/a.png)\n\n正文', repoRoot);
  assert.equal(missing.removed.length, 1);
  assert.ok(!missing.text.includes('images/a.png'));
  assert.ok(missing.text.includes('正文'));
  const existing = stripMissingImages('![图](README.md)', repoRoot);
  assert.equal(existing.removed.length, 0, '本地存在的文件不自动删，交给校验去拒');
});
