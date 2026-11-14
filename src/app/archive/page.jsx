import { getEntries, listEntries } from '../../lib/entries.mjs';
import EntryList from '../../components/EntryList';
export const metadata = { title: '全部归档', alternates: { canonical: '/archive/' } };
export default function ArchivePage() {
  const entries = getEntries();
  const years = [...new Set(entries.map(entry => entry.date.slice(0, 4)))];
  return <div className="collection-page shell"><div className="breadcrumbs micro"><a href="/">生长</a><span>/</span><span>归档</span></div><header className="collection-header"><p className="eyebrow">THE COLLECTED DAYS</p><h1>日子有迹可循。</h1><p>把零散的片段，交还给时间。<br/>日记、阅读与思考，都能在这里找到来处。</p><div className="archive-years micro">{years.map(year => <span key={year}>{year} <span>— {entries.filter(entry => entry.date.startsWith(year)).length} 篇</span></span>)}</div></header><EntryList entries={listEntries(entries)}/></div>;
}
