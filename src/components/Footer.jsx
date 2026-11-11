import { site } from '../lib/site.mjs';

export default function Footer() {
  return <footer className="site-footer">
    <div className="footer-main shell">
      <div className="footer-intro"><a className="footer-brand" href="/">大鹏的日记<span>·</span></a><p>记下生活，也记下想法。<br/>给平常的日子，留一个可以回来的地方。</p><span className="micro">中文写作 · 慢慢更新</span></div>
      <div className="footer-column"><span className="micro">翻阅 / READ</span><a href="/journal/">日记</a><a href="/notes/">阅读笔记</a><a href="/archive/">全部归档</a></div>
      <div className="footer-column"><span className="micro">连接 / FOLLOW</span><a href="/rss.xml">RSS 订阅 ↗</a><a href="/about/">关于这里</a><a href={site.repository} target="_blank" rel="noreferrer noopener">GitHub ↗</a></div>
    </div>
    <div className="footer-bottom shell"><span>© 2026 大鹏的日记</span><span>用文字，留住一些日常。</span><a href="/about/#trial">试刊 · 公开札记</a></div>
  </footer>;
}
