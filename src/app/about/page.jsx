import { getEntries } from '../../lib/entries.mjs';

export const metadata = { title: '关于这里', alternates: { canonical: '/about/' } };
export default function AboutPage() {
  const entries = getEntries();
  const fictional = entries.filter(entry => entry.demo).length;
  const notes = entries.filter(entry => entry.kind === 'note').length;
  return <div className="about-page shell"><div className="breadcrumbs micro"><a href="/">大鹏的日记</a><span>/</span><span>关于</span></div><header className="collection-header"><p className="eyebrow">A SMALL PLACE FOR WORDS</p><h1>给日常，<br/>一个位置。</h1><p>写下此刻，留给漫长的以后。</p></header><div className="about-body prose"><p>这里记录生活里的片段：一次散步，一页书，或者一个终于慢下来的早晨。</p><p>也放一些阅读的注脚。把读到的内容整理下来，把尚未想明白的问题留下来，让想法慢慢有自己的形状。</p><p>不追求每天都有答案，只希望在回头看的时候，还能认出当时的自己。</p><h2 id="trial">关于这次试刊</h2><p>首批试刊收录 {fictional} 篇虚构日记与 {notes} 篇已有学习笔记。虚构日记中的人物、地点和事件均为演示用途；学习笔记保留公开讲者及信息来源，健康案例中的个体姓名作了模糊处理。</p><p>学习笔记中的引述、统计与观点未在本次建站中独立核验。页面日期为本次收录日期，原文标明的调研时间另行保留。</p><blockquote><p>愿我们始终有心情，看见平常日子里的光。</p></blockquote><a className="read-link" href="/">回到日记 ↗</a></div></div>;
}
