import { Marked, Renderer } from 'marked';

export function plainText(markdown) {
  return markdown.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/[*_`~>|]/g, '').replace(/\s+/g, ' ').trim();
}

export function readingStats(markdown) {
  const text = plainText(markdown);
  const han = text.match(/\p{Script=Han}/gu)?.length || 0;
  const latin = text.replace(/\p{Script=Han}/gu, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length || 0;
  return { words: han + latin, minutes: Math.max(1, Math.ceil((han + latin) / 450)) };
}

const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 只为少数语言准备关键字表；不做通用语法解析，宁可不高亮，也不要高亮错。
const KEYWORDS = {
  js: 'const let var function return if else for while import export from default class extends new await async try catch finally throw typeof instanceof in of null undefined true false this switch case break continue do delete void yield static get set',
  py: 'def class return if elif else for while import from as pass break continue try except finally raise with lambda None True False and or not is in global nonlocal yield assert async await del print',
  sh: 'if then else elif fi for while do done case esac function return export local echo cd ls sudo npm node git curl grep cat mkdir rm cp mv chmod chown kill ps set',
  sql: 'select from where insert into values update set delete create table alter drop join left right inner outer on group by order having limit offset as distinct and or not null',
};
const LANGUAGE_ALIASES = {
  js: 'js', jsx: 'js', javascript: 'js', ts: 'js', tsx: 'js', typescript: 'js', mjs: 'js', cjs: 'js', node: 'js',
  py: 'py', python: 'py',
  sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
  sql: 'sql',
};

const TOKEN_PATTERNS = {
  js: {
    string: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/,
    comment: /\/\/[^\n]*|\/\*[\s\S]*?\*\//,
  },
  py: { string: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/, comment: /#[^\n]*/ },
  sh: { string: /"(?:\\.|[^"\\])*"|'[^']*'/, comment: /#[^\n]*/ },
  sql: { string: /'(?:''|[^'])*'/, comment: /--[^\n]*/ },
};

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 轻量代码高亮：在构建期把源码切成带 class 的片段，浏览器端零 JS。
 * 只认字符串、注释、数字和关键字四类，够用且不会认错。
 */
export function highlightCode(code, language) {
  const key = LANGUAGE_ALIASES[(language || '').toLowerCase()] || '';
  const pattern = TOKEN_PATTERNS[key];
  const keywords = new Set((KEYWORDS[key] || '').split(/\s+/).filter(Boolean));
  const keywordRe = keywords.size ? new RegExp(`^(?:${[...keywords].map(escapeRegExp).join('|')})$`) : null;

  if (!pattern) return escapeHtml(code);

  const parts = [];
  const scanner = new RegExp(`(${pattern.string.source})|(${pattern.comment.source})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)`, 'g');
  let last = 0;
  for (const match of code.matchAll(scanner)) {
    parts.push(escapeHtml(code.slice(last, match.index)));
    const [whole, str, com, num, word] = match;
    if (str) parts.push(`<span class="tok-str">${escapeHtml(str)}</span>`);
    else if (com) parts.push(`<span class="tok-com">${escapeHtml(com)}</span>`);
    else if (num) parts.push(`<span class="tok-num">${escapeHtml(num)}</span>`);
    else if (word && keywordRe?.test(word)) parts.push(`<span class="tok-kw">${escapeHtml(word)}</span>`);
    else parts.push(escapeHtml(word));
    last = match.index + whole.length;
  }
  parts.push(escapeHtml(code.slice(last)));
  return parts.join('');
}

export function renderMarkdown(markdown) {
  const headings = [];
  let headingIndex = 0;
  const renderer = new Renderer();
  renderer.heading = function(token) {
    const id = `section-${++headingIndex}`;
    const title = plainText(token.text);
    if (token.depth === 2 || token.depth === 3) headings.push({ id, title, depth: token.depth });
    return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };
  renderer.code = function(token) {
    const language = (token.lang || '').trim().split(/\s+/)[0] || '';
    const label = language ? `<figcaption>${escapeHtml(language)}</figcaption>` : '';
    const body = highlightCode(token.text, language);
    const className = language ? ` class="language-${escapeHtml(language)}"` : '';
    return `<figure class="code-fence">${label}<pre><code${className}>${body}</code></pre></figure>\n`;
  };
  const originalTable = renderer.table;
  renderer.table = function(token) {
    return `<div class="table-scroll" role="region" aria-label="文章表格，可横向滚动" tabindex="0">${originalTable.call(this, token)}</div>`;
  };
  const parser = new Marked({ renderer, gfm: true });
  const html = parser.parse(markdown);
  return { html, headings };
}
