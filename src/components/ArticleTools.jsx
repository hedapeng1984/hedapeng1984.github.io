'use client';

import { useEffect, useState } from 'react';

export default function ArticleTools({ headings }) {
  const [active, setActive] = useState(headings[0]?.id || '');
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const prose = document.getElementById('article-content');
    if (!prose) return;
    let frame = 0;
    const update = () => {
      const top = prose.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, prose.offsetHeight - window.innerHeight * 0.55);
      setProgress(Math.round(Math.min(100, Math.max(0, (window.scrollY - top + 140) / distance * 100))));
      const current = headings.map(heading => document.getElementById(heading.id)).filter(Boolean).filter(node => node.getBoundingClientRect().top <= 180).at(-1);
      setActive(current?.id || headings[0]?.id || '');
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [headings]);
  const links = headings.map(heading => <a href={`#${heading.id}`} key={heading.id} className={`${active === heading.id ? 'is-current ' : ''}${heading.depth === 3 ? 'toc-sub' : ''}`} aria-current={active === heading.id ? 'location' : undefined} onClick={() => setActive(heading.id)}>{heading.title}</a>);
  return <>
    <div className="reading-progress" role="progressbar" aria-label="阅读进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }}/></div>
    {headings.length > 0 && <><aside className="reading-rail"><nav className="toc-inner" aria-label="文章目录"><span className="micro">ON THIS PAGE / 目录</span><div className="toc-links">{links}</div><a className="toc-top" href="#article-top">回到开篇 ↑</a></nav></aside><details className="mobile-toc"><summary>这一页的目录 <span>{headings.length} 节</span></summary><nav className="toc-links" aria-label="移动端文章目录">{links}</nav></details></>}
  </>;
}
