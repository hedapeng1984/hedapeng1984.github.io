import test from 'node:test';
import assert from 'node:assert/strict';
import { redactEntry } from '../scripts/content-lib.mjs';

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

test('手写 replacements 优先于拼音首字母', () => {
  const text = redactEntry(entry('王小明来了。'), { ...rules, replacements: { 王小明: '一位朋友' } });
  assert.ok(text.includes('一位朋友'), text);
  assert.ok(!text.includes('WXM'), text);
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
