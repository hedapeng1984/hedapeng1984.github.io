'use client';

import { useEffect, useMemo, useState } from 'react';

export default function EntryList({ entries, layout = 'rows', searchable = true }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const tags = useMemo(() => ['全部', ...new Set(entries.flatMap(entry => entry.tags))], [entries]);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('tag');
    if (selected && entries.some(entry => entry.tags.includes(selected))) setTag(selected);
  }, [entries]);
  const filtered = entries.filter(entry => (tag === '全部' || entry.tags.includes(tag)) && `${entry.title} ${entry.summary} ${entry.searchText}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    {searchable && <div className="journal-tools" id="search"><div className="filter-tabs" role="group" aria-label="按主题筛选">{[...new Set([...tags, ...(tag !== '全部' ? [tag] : [])])].map(value => <button type="button" className={`filter ${tag === value ? 'active' : ''}`} key={value} aria-pressed={tag === value} onClick={() => setTag(value)}>{value}</button>)}</div><label className="search-field"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span className="sr-only">搜索日记与笔记</span><input id="journal-search" type="search" placeholder="在文字里找一找…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off"/></label></div>}
    <div className={layout === 'grid' ? 'entry-list entry-grid' : 'entry-list entry-rows'}>
      {filtered.map((entry, index) => <article className={`entry-row ${layout === 'grid' ? 'entry-card' : ''}`} key={entry.id}>
        <div className="entry-date"><time dateTime={entry.date}>{entry.date.replaceAll('-', '.')}</time><span>{entry.kind === 'note' ? '笔记' : '日记'}</span></div>
        <div className="entry-copy"><div className="entry-meta">{entry.tags.join(' / ')}{entry.demo && <span className="fiction-label">虚构示例</span>}</div><h3><a href={`/diary/${entry.id}/`}>{entry.title}</a></h3><p>{entry.summary}</p><a className="read-link" href={`/diary/${entry.id}/`}>展开这一页 <span aria-hidden="true">↗</span><span className="sr-only">：{entry.title}</span></a></div>
        <span className="entry-index micro" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </article>)}
    </div>
    <p className="search-status" id="search-status" aria-live="polite">{filtered.length === 0 ? '还没有找到这段文字，换个关键词试试。' : query.trim() || tag !== '全部' ? `找到 ${filtered.length} 篇文章` : ''}</p>
  </>;
}
