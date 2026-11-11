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
  const originalTable = renderer.table;
  renderer.table = function(token) {
    return `<div class="table-scroll" role="region" aria-label="文章表格，可横向滚动" tabindex="0">${originalTable.call(this, token)}</div>`;
  };
  const parser = new Marked({ renderer, gfm: true });
  const html = parser.parse(markdown);
  return { html, headings };
}
