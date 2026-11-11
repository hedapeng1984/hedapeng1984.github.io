import EntryList from '../components/EntryList';
import { getEntries, listEntries } from '../lib/entries.mjs';
import { articleUrl } from '../lib/site.mjs';

export const metadata = { alternates: { canonical: '/' } };

export default function HomePage() {
  const entries = getEntries();
  const journals = entries.filter(entry => entry.kind === 'journal');
  const notes = entries.filter(entry => entry.kind === 'note');
  const latestDate = entries[0].date;
  const topics = ['生活', '阅读', '思考', '健康'].map(tag => ({ tag, count: entries.filter(entry => entry.tags.includes(tag)).length })).filter(topic => topic.count > 0);
  return <>
    <section className="hero shell">
      <div className="hero-intro"><p className="eyebrow">生活 · 阅读 · 思考 · 持续记录</p><h1>把日子写下，<br/>让想法<br/><em>慢慢生长。</em></h1><p className="hero-description">一些生活的片段，一些阅读的注脚。<br/>给平常的日子，留一个可以回来的地方。</p><dl className="hero-colophon"><div><dt>THE JOURNAL</dt><dd>日常与阅读的公开札记</dd></div><div><dt>LANGUAGE</dt><dd>中文写作 · 保留原文引述</dd></div><div><dt>THIS ISSUE</dt><dd>{journals.length} 篇日记 · {notes.length} 篇学习笔记</dd></div></dl></div>
      <aside className="dispatch"><span className="dispatch-label micro">§ DISPATCH · 此刻的记录</span><div className="dispatch-opening"><span className="dispatch-asterisk" aria-hidden="true">✳</span><p>把读到的、想到的、<br/>经历过的，放在一起。</p><span className="dispatch-english">A commonplace book,<br/><em>kept in public.</em></span></div><div className="dispatch-rule"><span>§</span></div><dl className="dispatch-notes">{journals[0] && <div><dt>日常 / LIFE</dt><dd><a href={articleUrl(journals[0])}>{journals[0].title} <span aria-hidden="true">↗</span></a></dd></div>}{notes[0] && <div><dt>阅读 / NOTES</dt><dd><a href={articleUrl(notes[0])}>{notes[0].title} <span aria-hidden="true">↗</span></a></dd></div>}<div><dt>收录 / PAGES</dt><dd>{entries.length} 篇公开记录，<a href="/archive/">按时间慢慢翻阅 →</a></dd></div></dl><div className="dispatch-footer"><span className="micro">留住一些日常</span><time className="date-stamp micro" dateTime={latestDate}>{latestDate.replaceAll('-', ' / ')}</time></div></aside>
    </section>
    <div className="ticker shell" aria-label="本期更新"><span className="micro">CURRENTLY</span><a href={articleUrl(entries[0])}>{entries[0].title}</a><span className="ticker-dot">·</span><span>{entries.length} 篇记录</span><span className="ticker-dot">·</span><a href="/notes/">阅读之后，留一点自己的注脚</a><span className="ticker-end micro">VOL. 02 / 试刊</span></div>
    <section className="latest-section shell"><div className="section-heading"><span className="eyebrow">§ 01 · THE JOURNAL</span><h2>把想法，放回日常。</h2><a className="section-link micro" href="/archive/">完整归档 →</a></div><EntryList entries={listEntries(entries)} layout="grid"/><p className="edition-note micro">首批试刊包含两篇虚构日记与两篇已有学习笔记。</p></section>
    <section className="topics-section"><div className="shell"><div className="section-heading"><span className="eyebrow">§ 02 · A FEW THREADS</span><h2>沿着一个念头，继续读。</h2><a className="section-link micro" href="/notes/">阅读笔记 →</a></div><div className="topic-shelf">{topics.map((topic, index) => <a className="topic-volume" key={topic.tag} href={`/archive/?tag=${encodeURIComponent(topic.tag)}`}><span className="topic-number micro">0{index + 1}</span><span className="topic-name">{topic.tag}</span><span className="topic-count micro">{topic.count} 篇记录</span><span className="topic-arrow" aria-hidden="true">↗</span></a>)}</div></div></section>
    <div className="closing-note shell"><span className="micro">A NOTE TO THE FUTURE</span><p>平常的日子，也有自己的光。</p><span className="closing-star" aria-hidden="true">✳</span></div>
  </>;
}
