import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';

export function digest(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function parseEntry(text) {
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('日记缺少 YAML 元信息。');
  const meta = parse(match[1]);
  if (!meta || typeof meta !== 'object') throw new Error('元信息格式不正确。');
  const entry = { ...meta, body: match[2].trim() };
  validateEntry(entry);
  return entry;
}

export function validateEntry(entry) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id ?? '')) throw new Error('id 必须是稳定的英文短标识。');
  if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date + 'T00:00:00Z')) || new Date(entry.date + 'T00:00:00Z').toISOString().slice(0, 10) !== entry.date) throw new Error('日期必须为有效的 YYYY-MM-DD。');
  for (const key of ['title', 'summary', 'body']) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`缺少 ${key}。`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string')) throw new Error('tags 必须是文字列表。');
  if (/<\s*(?:[a-z!/?])/i.test(entry.body)) throw new Error('试刊不接受原始 HTML。');
  // 附件需要独立审核，本试验不自动复制任何图片、音频或文件。
  if (/!\[|!\[\[|\[\[|\]\s*\(|^\s*\[[^\]]+\]:|\b(?:https?|file|data|javascript):|[A-Z]:[\\/]/im.test(entry.body)) {
    throw new Error('试刊暂不接受链接或附件，请先移除；不能把本地附件自动公开。');
  }
}

export function serializeEntry(entry) {
  return `---\n${stringify({
    id: entry.id,
    title: entry.title,
    date: entry.date,
    tags: entry.tags,
    summary: entry.summary,
    demo: true,
  }).trimEnd()}\n---\n\n${entry.body.trim()}\n`;
}

export function redactEntry(text, rules) {
  const entry = parseEntry(text);
  const replace = value => {
    let result = value;
    for (const [from, to] of Object.entries(rules.replacements ?? {}).sort((a, b) => b[0].length - a[0].length)) {
      if (!from) throw new Error('替换规则不能包含空字符串。');
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
  };
  validateEntry(publicEntry);
  return serializeEntry(publicEntry);
}

export function assertApproved(text, record, id) {
  if (!record || record.sha256 !== digest(text)) throw new Error(`${id} 的公开稿未审核或审核后被修改，已阻止构建。`);
  const entry = parseEntry(text);
  if (entry.id !== id) throw new Error('文件名与日记 id 不一致。');
  if (entry.demo !== true) throw new Error('本次试刊仅接受标记为虚构的测试日记。');
  const allowed = new Set(['id', 'date', 'title', 'summary', 'tags', 'demo', 'body']);
  if (Object.keys(entry).some(key => !allowed.has(key))) throw new Error('公开稿含有未经允许的元信息。');
  return entry;
}
