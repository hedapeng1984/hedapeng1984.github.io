import test from 'node:test';
import assert from 'node:assert/strict';
import { findSuspects, redactEntry } from '../scripts/content-lib.mjs';

const entry = (body, extra = '') => `---
id: sample-entry
title: 和林知远散步
date: 2026-11-11
tags: [生活]
summary: 林知远在星河市梧桐路18号
${extra}
---

${body}
`;

const rules = { names: ['林知远', '陈书宁'], places: ['星河市梧桐路', '宁波'] };

test('名单里的人名与地点替换成拼音首字母', () => {
  const text = redactEntry(entry('林知远和陈书宁在星河市梧桐路散步。'), rules);
  assert.ok(text.includes('LZY和CSN在XHSWTL散步'), text);
  assert.ok(!text.includes('林知远'));
  assert.ok(!text.includes('陈书宁'));
  assert.ok(!text.includes('星河市梧桐路'));
});

test('标题、摘要、正文、标签都用同一套替换', () => {
  const text = redactEntry(entry('林知远来了。'), rules);
  assert.ok(!text.includes('林知远'));
  assert.ok(text.includes('LZY'));
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
  const text = redactEntry(entry('林知远来了。'), { ...rules, replacements: { 林知远: '一位朋友' } });
  assert.ok(text.includes('一位朋友'), text);
  assert.ok(!text.includes('LZY'), text);
});

test('更长的规则先替换，短规则不会先命中', () => {
  const text = redactEntry(entry('林知远在。'), { names: ['林', '林知远'] });
  assert.ok(text.includes('LZY'), text);
});

test('没有登记的疑似人名与地点只报告，不自动替换', () => {
  const text = redactEntry(entry('王小明在杭州东站等陈书宁。'), rules);
  assert.ok(text.includes('王小明'), '未登记的人名不应被自动替换');
  assert.ok(text.includes('杭州东站'), '未登记的地点不应被自动替换');
  assert.ok(text.includes('CSN'), '已登记的人名仍然要替换');

  const suspects = findSuspects(entry('王小明在杭州东站等陈书宁。'), rules);
  assert.ok(suspects.names.includes('王小明'), JSON.stringify(suspects));
  assert.ok(!suspects.names.includes('陈书宁'), '已登记的不应再报告');
  assert.ok(suspects.places.includes('杭州'), JSON.stringify(suspects));
});

test('姓加称谓不算疑似人名', () => {
  const suspects = findSuspects(entry('徐老师和李总都在。'), rules);
  assert.ok(!suspects.names.includes('徐老师'), JSON.stringify(suspects));
  assert.ok(!suspects.names.includes('李总'), JSON.stringify(suspects));
});

test('规则里的名单必须是列表', () => {
  assert.throws(() => redactEntry(entry('正文。'), { names: '林知远' }), /必须是一个列表/);
  assert.throws(() => redactEntry(entry('正文。'), { places: [''] }), /不能包含空字符串/);
});

test('地点后面跟着通称的不算具体地点', () => {
  // 「个不大的广场」「第二天在超市」都是通称，不是具体地点
  const suspects = findSuspects(entry('这是一个不大的广场，第二天在超市买菜。'), rules);
  assert.ok(!suspects.places.some(item => item.endsWith('广场')), JSON.stringify(suspects));
  assert.ok(!suspects.places.some(item => item.endsWith('超市')), JSON.stringify(suspects));
});

test('地点前面的定语和介词不并入地名', () => {
  const suspects = findSuspects(entry('他从清华大学去了美国杜克大学。'), rules);
  assert.ok(suspects.places.includes('清华大学'), JSON.stringify(suspects));
  assert.ok(suspects.places.includes('美国杜克大学'), JSON.stringify(suspects));
  assert.ok(!suspects.places.some(item => item.startsWith('从')), JSON.stringify(suspects));
});

test('已登记地点的片段不再重复报告', () => {
  // 名单里有「星河市梧桐路18号」，就不该再报「18号」
  const suspects = findSuspects(entry('我们在星河市梧桐路18号碰面。'), { places: ['星河市梧桐路18号'] });
  assert.ok(!suspects.places.includes('18号'), JSON.stringify(suspects));
});
