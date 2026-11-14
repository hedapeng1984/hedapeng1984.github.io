import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { marked } from 'marked';
import { detectNames, detectPlaces, maskName } from './redact.mjs';

export function digest(text) {
  return createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex');
}

export function parseEntry(text, options = {}) {
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('日记缺少 YAML 元信息。');
  const meta = parse(match[1]);
  if (!meta || typeof meta !== 'object') throw new Error('元信息格式不正确。');
  const entry = { ...meta, body: match[2].trim() };
  validateEntry(entry, options);
  return entry;
}

export function validateEntry(entry, { allowUnreviewedLinks = false } = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id ?? '')) throw new Error('id 必须是稳定的英文短标识。');
  if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date + 'T00:00:00Z')) || new Date(entry.date + 'T00:00:00Z').toISOString().slice(0, 10) !== entry.date) throw new Error('日期必须为有效的 YYYY-MM-DD。');
  for (const key of ['title', 'summary', 'body']) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`缺少 ${key}。`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string')) throw new Error('tags 必须是文字列表。');
  if (entry.kind !== undefined && !['journal', 'note'].includes(entry.kind)) throw new Error('kind 只能是 journal 或 note。');
  if (/<\s*(?:[a-z!/?])/i.test(entry.body)) throw new Error('试刊不接受原始 HTML。');
  // 来源链接可以公开，图片和本地附件必须另行审核，不能自动复制。
  if (/!\[\[|\[\[|(?<![a-z0-9])[A-Z]:[\\/]/im.test(entry.body)) throw new Error('不接受本地路径或双向链接。');
  marked.walkTokens(marked.lexer(entry.body), token => {
    if (token.type === 'image' || token.type === 'html') throw new Error('不接受未经审核的图片、附件或 HTML。');
    if (token.type === 'link' && !allowUnreviewedLinks) {
      if (token.href.startsWith('#')) return;
      let target;
      try { target = new URL(token.href); } catch { throw new Error('不接受本地附件或相对链接。'); }
      if (target.protocol !== 'https:' || target.username || target.password || /^(localhost|127\.|10\.|192\.168\.|0\.|\[?::1\]?)/i.test(target.hostname)) throw new Error('只接受不含凭据的公开 HTTPS 来源链接。');
    }
  });
}

export function serializeEntry(entry) {
  return `---\n${stringify({
    id: entry.id,
    title: entry.title,
    date: entry.date,
    tags: entry.tags,
    summary: entry.summary,
    demo: entry.demo ?? true,
    ...(entry.kind ? { kind: entry.kind } : {}),
  }).trimEnd()}\n---\n\n${entry.body.trim()}\n`;
}

export function redactEntry(text, rules) {
  const entry = parseEntry(text, { allowUnreviewedLinks: true });
  const replace = value => {
    let result = value;
    for (const [from, to] of buildReplacements(rules)) {
      result = result.split(from).join(to);
    }
    return result
      .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, '［手机号已隐藏］')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '［邮箱已隐藏］');
  };
  const publicEntry = {
    id: entry.id,
    date: entry.date,
    title: replace(entry.title),
    summary: replace(entry.summary),
    tags: entry.tags.map(replace),
    body: replace(entry.body),
    demo: entry.demo ?? true,
    ...(entry.kind ? { kind: entry.kind } : {}),
  };
  validateEntry(publicEntry);
  return serializeEntry(publicEntry);
}

/**
 * 把规则整理成一张「原文 → 替代写法」的表，按原文长度倒序（长��先替，避免短串先命中）。
 *
 * 三类规则：
 *   replacements —— 手写字面替换，优先级最高（你已经明确指定了替代词，就用它）。
 *   names        —— 人名，转成拼音首字母（王小明 → WXM）。
 *   places       —— 具体地点名，转成拼音首字母（某某市某某路 → MMSMML）。
 *
 * 单字条目一律跳过：按你的规则，只出现姓氏时不需要脱敏（徐老师、李总）。
 * 把单字姓氏写进名单会误伤「李总」「王阿姨」这类称呼，也会误伤以姓氏开头的普通词。
 */
export function buildReplacements(rules) {
  const manual = Object.entries(rules?.replacements ?? {});
  const listed = [];
  for (const [key, group] of [['names', '人名'], ['places', '地点名']]) {
    const values = rules?.[key];
    if (values === undefined) continue;
    if (!Array.isArray(values)) throw new Error(`规则里的 ${key} 必须是一个列表。`);
    for (const value of values) {
      const source = String(value ?? '').trim();
      if (!source) throw new Error(`${group}规则不能包含空字符串。`);
      if ([...source].length < 2) continue;      // 单字（只有姓）不脱敏
      const masked = maskName(source);
      if (!masked || masked === source) continue;
      listed.push([source, masked]);
    }
  }
  return [...manual, ...listed].sort((a, b) => b[0].length - a[0].length);
}

/**
 * 找出稿子里还没登记进名单的疑似人名与地点。
 *
 * 只报告，不自动替换：中文里大量普通词以姓氏开头（说明、和平、方向、马路……），
 * 自动替换会把正文改得莫名其妙，而且很难看出「BT」原来是「白天」。
 * 漏登记的风险由审稿环节兜底 —— 你在待审稿里能一眼看出不对劲。
 */
export function findSuspects(text, rules = {}) {
  const entry = parseEntry(text, { allowUnreviewedLinks: true });
  const listed = key => {
    const values = rules[key];
    if (values === undefined) return [];
    if (!Array.isArray(values)) throw new Error(`规则里的 ${key} 必须是一个列表。`);
    return values.map(value => String(value ?? '').trim()).filter(Boolean);
  };
  const registeredNames = listed('names');
  const registeredPlaces = listed('places');
  // 已经登记的长条目会覆盖它的片段（登记了「某某路12号」，不必再报「12号」）。
  // 单字姓氏不算覆盖 —— 它本来就不参与替换。
  const covered = (value, list) => list.some(item => [...item].length > 1 && (item.includes(value) || value.includes(item)));
  const searchable = [entry.title, entry.summary, entry.tags.join(' '), entry.body].join('\n');
  const names = detectNames(searchable).filter(value => !registeredNames.includes(value) && !covered(value, registeredNames));
  const places = detectPlaces(searchable).filter(value => !registeredPlaces.includes(value) && !covered(value, registeredPlaces));
  return { names, places };
}

export function assertApproved(text, record, id) {
  if (!record || record.sha256 !== digest(text)) throw new Error(`${id} 的公开稿未审核或审核后被修改，已阻止构建。`);
  const entry = parseEntry(text);
  if (entry.id !== id) throw new Error('文件名与日记 id 不一致。');
  if (typeof entry.demo !== 'boolean') throw new Error('必须明确标记是否为虚构内容。');
  const allowed = new Set(['id', 'date', 'title', 'summary', 'tags', 'demo', 'kind', 'body']);
  if (Object.keys(entry).some(key => !allowed.has(key))) throw new Error('公开稿含有未经允许的元信息。');
  return entry;
}
