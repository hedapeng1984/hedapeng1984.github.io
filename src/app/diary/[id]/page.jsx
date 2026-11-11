import { notFound } from 'next/navigation';
import { getEntries } from '../../../lib/entries.mjs';
import { articleUrl, chineseDate } from '../../../lib/site.mjs';
import ArticleTools from '../../../components/ArticleTools';

export const dynamicParams = false;
export function generateStaticParams() { return getEntries().map(entry => ({ id: entry.id })); }
export async function generateMetadata({ params }) {
  const { id } = await params;
  const entry = getEntries().find(entry => entry.id === id);
  if (!entry) return { title: '这一页暂时留白' };
  return { title: entry.title, description: entry.summary, alternates: { canonical: articleUrl(entry) }, openGraph: { title: entry.title, description: entry.summary, type: 'article', publishedTime: entry.date + 'T00:00:00+08:00', locale: 'zh_CN' } };
}
export default async function ArticlePage({ params }) {
  const { id } = await params;
  const entries = getEntries();
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) notFound();
  const entry = entries[index];
  const newer = entries[index - 1];
  const older = entries[index + 1];
  return <article className="article-page shell" id="article-top"><div className="breadcrumbs micro"><a href="/">大鹏的日记</a><span>/</span><a href={entry.kind === 'note' ? '/notes/' : '/journal/'}>{entry.kind === 'note' ? '阅读笔记' : '日记'}</a><span>/</span><span>{entry.title}</span></div><header className="article-header"><div className="article-overline"><time className="micro" dateTime={entry.date}>{chineseDate(entry.date)}</time><span className="micro">约 {entry.words.toLocaleString('zh-CN')} 字 · {entry.minutes} 分钟</span><span className="language-label micro">中文 / ZH</span></div><h1>{entry.title}</h1><p className="article-summary">{entry.summary}</p><div className="article-tags"><span className="micro">{entry.tags.join(' / ')}</span><span className="micro">{entry.demo ? '虚构日记 · 试刊' : entry.kind === 'note' ? '学习笔记 · 原文整理' : '日记 · 公开札记'}</span></div>{entry.kind === 'note' && <p className="source-note">本文为既有资料的学习笔记，按原文整理导入；引述、统计与观点未在本次建站中独立核验。</p>}</header><div className="article-body"><ArticleTools headings={entry.headings}/><div className="prose" id="article-content" dangerouslySetInnerHTML={{ __html: entry.html }}/></div><div className="article-ending"><span>§</span><p>这一页，暂且写到这里。</p><a href="/archive/">回到全部日记 →</a></div><nav className="article-nav" aria-label="相邻文章"><div>{older && <a href={articleUrl(older)}><span className="micro">← 较早的一页</span><strong>{older.title}</strong></a>}</div><div>{newer && <a href={articleUrl(newer)}><span className="micro">较新的一页 →</span><strong>{newer.title}</strong></a>}</div></nav></article>;
}
