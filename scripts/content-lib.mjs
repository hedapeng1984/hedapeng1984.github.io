import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { marked } from 'marked';
import { maskName } from './redact.mjs';

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
  if (/<\s*(?:[a-z!/?])/i.test(entry.body)) throw new Error('本站不接受原始 HTML。');
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
    for (const [from, to] of buildMaskRules(rules)) {
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
    // 原稿可能是 Windows 换行。统一成 LF —— 待审稿和公开稿混着两种换行，
    // 人工比对时整篇都显示成「改过了」，真改动反而看不见。
    body: replace(entry.body).replace(/\r\n?/g, '\n'),
    demo: entry.demo ?? true,
    ...(entry.kind ? { kind: entry.kind } : {}),
  };
  validateEntry(publicEntry);
  return serializeEntry(publicEntry);
}

/**
 * 把规则整理成一张「原文 → 替代写法」的表，按原文长度倒序（长的先替，避免短串先命中）。
 *
 * 只有一类规则：
 *   names —— 人名全名，转成拼音首字母（王小明 → WXM）。
 *
 * 单字条目一律跳过：按你的规则，只出现姓氏时不需要脱敏（徐老师、李总）。
 * 把单字姓氏写进名单会误伤「李总」「王阿姨」这类称呼，也会误伤以姓氏开头的普通词。
 */
export function buildMaskRules(rules) {
  const listed = [];
  const values = rules?.names;
  if (values !== undefined) {
    if (!Array.isArray(values)) throw new Error('规则里的 names 必须是一个列表。');
    for (const value of values) {
      const source = String(value ?? '').trim();
      if (!source) throw new Error('人名规则不能包含空字符串。');
      if ([...source].length < 2) continue;      // 单字（只有姓）不脱敏
      const masked = maskName(source);
      if (!masked || masked === source) continue;
      listed.push([source, masked]);
    }
  }
  return listed.sort((a, b) => b[0].length - a[0].length);
}

/**
 * 提醒清单：只报不改。
 *
 * 系统不猜哪些字敏感（中文里说明、和平、方向、马路都像人名，猜错的代价比漏掉更大），
 * 所以由你把要盯的少数字串写进 rules.alert。整理时列出命中的行号，
 * 由你自己决定改成什么写法 —— 改完直接编辑待审稿，原稿不动。
 */
export function findAlerts(text, rules) {
  const values = rules?.alert;
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw new Error('规则里的 alert 必须是一个列表。');
  const lines = String(text ?? '').split('\n');
  const hits = [];
  for (const value of values) {
    const term = String(value ?? '').trim();
    if (!term) throw new Error('提醒清单不能包含空字符串。');
    const at = [];
    lines.forEach((line, index) => {
      if (line.includes(term)) at.push(index + 1);
    });
    if (at.length) hits.push({ term, lines: at });
  }
  return hits;
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
