export const site = {
  name: '生长',
  handle: 'HEDAPENG',
  url: 'https://www.hedapeng.com',
  description: '一些生活的片段，一些阅读的注脚。写下此刻，留给漫长的以后。',
  repository: 'https://github.com/hedapeng1984/hedapeng1984.github.io',
  // 试刊结束，站点已开放搜索引擎收录。改回 true 可一键恢复 noindex。
  trial: false,
};

// 兼容首批稿件；新日记默认为 journal，新笔记可在元信息设置 kind: note。
export const legacyNoteIds = new Set(['musk-thinking', 'cancer-learning-notes']);
export const entryKind = entry => entry.kind || (legacyNoteIds.has(entry.id) ? 'note' : 'journal');
export const chineseDate = date => `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
export const compactDate = date => `${date.slice(5, 7)}.${date.slice(8, 10)}`;
export const articleUrl = entry => `/diary/${entry.id}/`;
