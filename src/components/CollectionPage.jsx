import EntryList from './EntryList';
import { listEntries } from '../lib/entries.mjs';

export default function CollectionPage({ entries, label, title, description }) {
  return <div className="collection-page shell"><div className="breadcrumbs micro"><a href="/">大鹏的日记</a><span>/</span><span>{label}</span></div><header className="collection-header"><p className="eyebrow">{label}</p><h1>{title}</h1><p>{description}</p><span className="collection-count micro">{entries.length} 篇记录 · 中文</span></header><EntryList entries={listEntries(entries)}/></div>;
}
