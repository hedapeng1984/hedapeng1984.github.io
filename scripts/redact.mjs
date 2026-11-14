// 脱敏工具：人名 → 拼音首字母。
//
// 就一条规则：privacy-rules.json 的 names 列表里写下的人名全名，
// 整篇替换成拼音首字母（王小明 → WXM）。
//
// 没有别的：
//   - 不猜哪些字像人名。中文里说明、和平、方向、马路都像人名，猜错的代价比漏掉的更大，
//     而且猜错了正文会莫名其妙。漏登记的兜底是审稿那一步，不是启发式。
//   - 不自动处理地名。要盯的少数字串写进 rules.alert，整理时只报行号，改法由你定。
//   - 只出现姓氏不脱敏。名单里写单字会被跳过，所以徐老师、李总原样保留。
//
// 拼音首字母表由 macOS 自带的 CoreFoundation/ICU（Han→Latin）离线生成，
// 是一张静态数据文件，运行时不依赖任何第三方包，也不依赖系统装了 ICU。
// 代价是按单字取音，不看上下文：多音字只取常用读音（长→Z、行→X）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const table = JSON.parse(fs.readFileSync(path.join(here, 'pinyin-initials.json'), 'utf8'));
const BASE = parseInt(table.base, 16);
const TABLE = table.table;

/** 汉字串 → 拼音首字母（大写）。非汉字原样保留。 */
export function pinyinInitials(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= BASE && cp < BASE + TABLE.length) {
      const initial = TABLE[cp - BASE] ?? '?';
      if (initial !== '?') out += initial;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * 一个名称的替代写法。
 * 纯英文名取各词首字母（Tony Blair → TB）；中文名取拼音首字母（王小明 → WXM）。
 */
export function maskName(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    return trimmed
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map(word => word[0].toUpperCase())
      .join('');
  }
  return pinyinInitials(trimmed);
}
