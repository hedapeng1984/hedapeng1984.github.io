import test from 'node:test';
import assert from 'node:assert/strict';
import { assertApproved, digest, findAlerts, parseEntry, redactEntry } from '../scripts/content-lib.mjs';

const original = `---\nid: sample-entry\ntitle: 和王小明散步\ndate: 2026-11-11\ntags: [生活]\nsummary: 王小明在某某市某某路18号\nprivateNote: 不可外传\n---\n\n王小明留下 13800000000 和 lin@example.com。\n`;
const rules = { names: ['王小明'], alert: ['某某市某某路18号'] };

test('正文、标题、摘要均脱敏，私人元信息不进入公开稿', () => {
  const publicText = redactEntry(original, rules);
  for (const secret of ['王小明', '13800000000', 'lin@example.com', 'privateNote', '不可外传']) assert.ok(!publicText.includes(secret), secret);
  assert.equal(parseEntry(publicText).title, '和WXM散步');
  assert.ok(publicText.includes('［手机号已隐藏］'));
});
test('提醒清单里的字串不会被自动改写，但会报出行号', () => {
  const publicText = redactEntry(original, rules);
  assert.ok(publicText.includes('某某市某某路18号'), '提醒只报不改');
  const hits = findAlerts(publicText, rules);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].term, '某某市某某路18号');
  assert.ok(hits[0].lines.length >= 1);
});
test('无审核记录或内容被修改后拒绝构建', () => {
  const text = redactEntry(original, rules);
  assert.throws(() => assertApproved(text, undefined, 'sample-entry'), /未审核/);
  const approved = { sha256: digest(text) };
  assertApproved(text, approved, 'sample-entry');
  assert.throws(() => assertApproved(text + '新增私人信息', approved, 'sample-entry'), /审核后被修改/);
});
test('不自动放行附件、图片、HTML 或不安全链接', () => {
  for (const payload of ['![图](../private/photo.jpg)', '![[私图.png]]', '<script>alert(1)</script>', '[点击](javascript:alert(1))', '[附件][file]\n\n[file]: ../private/file.pdf']) {
    assert.throws(() => redactEntry(original + payload, rules));
  }
});
test('无效日期、越界 id 被拒绝', () => {
  assert.throws(() => redactEntry(original.replace('sample-entry', '../private'), rules));
  assert.throws(() => redactEntry(original.replace('2026-11-11', '2026-02-31'), rules));
});
test('允许公开 HTTPS 来源，拒绝内网地址和明文 HTTP', () => {
  const publicText = redactEntry(original + '\n[来源](https://example.org/article)\n', rules);
  assert.ok(publicText.includes('https://example.org/article'));
  for (const url of ['http://example.org', 'https://localhost/a', 'https://192.168.1.1/a', 'https://user:pass@example.org/']) assert.throws(() => redactEntry(original + `\n[来源](${url})`, rules));
});
test('Windows 与 Mac/Linux 换行不同仍识别为同一审核版本', () => {
  const text = redactEntry(original, rules);
  const record = { sha256: digest(text) };
  assertApproved(text.replaceAll('\n', '\r\n'), record, 'sample-entry');
  assert.throws(() => assertApproved(text.replaceAll('\n', '\r\n') + '新增信息', record, 'sample-entry'), /审核后被修改/);
});
