import test from 'node:test';
import assert from 'node:assert/strict';
import { findAlerts, redactEntry } from '../scripts/content-lib.mjs';

// 测试数据一律用合成名字 —— 不写日记里真出现过的名字，免得它们跟着公开仓库走。
const entry = (body) => `---
id: sample-entry
title: 和王小明散步
date: 2026-11-11
tags: [生活]
summary: 王小明在某某市某某路18号
---

${body}
`;

const rules = { names: ['王小明', '李小花'] };

test('名单里的人名替换成拼音首字母', () => {
  const text = redactEntry(entry('王小明和李小花在散步。'), rules);
  assert.ok(text.includes('WXM和LXH在散步'), text);
  assert.ok(!text.includes('王小明'));
  assert.ok(!text.includes('李小花'));
});

test('标题、摘要、正文、标签都用同一套替换', () => {
  const text = redactEntry(entry('王小明来了。'), rules);
  assert.ok(!text.includes('王小明'));
  assert.ok(text.includes('WXM'));
});

test('只出现姓氏不脱敏：徐老师、李总原样保留', () => {
  const text = redactEntry(entry('徐老师和李总都在。'), { ...rules, names: ['徐', '李', ...rules.names] });
  assert.ok(text.includes('徐老师和李总都在'), text);
});

test('名单里的单字条目被忽略，不会误伤称呼', () => {
  const text = redactEntry(entry('李小龙来了，徐老师也在。'), { names: ['李', '李小龙'] });
  assert.ok(text.includes('LXL来了'), text);
  assert.ok(text.includes('徐老师'), text);
});

test('名单里的英文名取各词首字母', () => {
  const text = redactEntry(entry('Tony Blair 来了。'), { names: ['Tony Blair'] });
  assert.ok(text.includes('TB'), text);
  assert.ok(!text.includes('Tony'), text);
});

test('更长的规则先替换，短规则不会先命中', () => {
  const text = redactEntry(entry('王小明在。'), { names: ['王', '王小明'] });
  assert.ok(text.includes('WXM'), text);
});

test('名单里没有的名字原样保留，不猜也不替换', () => {
  const text = redactEntry(entry('赵小军来了。'), rules);
  assert.ok(text.includes('赵小军'), text);
});

test('规则里的名单必须是列表', () => {
  assert.throws(() => redactEntry(entry('正文。'), { names: '王小明' }), /必须是一个列表/);
  assert.throws(() => redactEntry(entry('正文。'), { names: [''] }), /不能包含空字符串/);
});

test('提醒清单只报行号，不动正文', () => {
  const text = redactEntry(entry('第一行。\n住在某某市某某路12号。\n第三行。'), { ...rules, alert: ['某某市某某路12号'] });
  assert.ok(text.includes('某某市某某路12号'), '提醒不改写正文');
  const hits = findAlerts(text, { alert: ['某某市某某路12号'] });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].term, '某某市某某路12号');
  const lines = text.split('\n');
  for (const at of hits[0].lines) assert.ok(lines[at - 1].includes('某某市某某路12号'), `第 ${at} 行`);
  assert.equal(hits[0].lines.length, 1);
});

test('提醒清单命中多处时列出所有行号', () => {
  const text = '住处在某某市。\n\n又提到某某市。';
  const hits = findAlerts(text, { alert: ['某某市'] });
  assert.deepEqual(hits[0].lines, [1, 3]);
});

test('没写提醒清单时不算错', () => {
  assert.deepEqual(findAlerts('正文。', {}), []);
  assert.deepEqual(findAlerts('正文。', { names: ['王小明'] }), []);
});

test('提醒清单必须是列表，且不能有空字符串', () => {
  assert.throws(() => findAlerts('正文。', { alert: '某某市' }), /必须是一个列表/);
  assert.throws(() => findAlerts('正文。', { alert: [''] }), /不能包含空字符串/);
});
