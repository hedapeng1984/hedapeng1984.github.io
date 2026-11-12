'use client';

import { useEffect, useState } from 'react';

const themes = ['system', 'light', 'warm', 'dark'];
const labels = { system: '跟随系统', light: '浅色', warm: '暖纸', dark: '深色' };
const nav = [['/journal/', '日记'], ['/notes/', '笔记'], ['/archive/', '归档'], ['/about/', '关于']];

export default function Header() {
  const [theme, setTheme] = useState('system');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let saved = 'system';
    try { const value = localStorage.getItem('journal-theme'); if (themes.includes(value)) saved = value; } catch {}
    setTheme(saved);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      let preference = 'system';
      try { preference = localStorage.getItem('journal-theme') || 'system'; } catch {}
      document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    };
    media.addEventListener('change', apply);
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { media.removeEventListener('change', apply); document.removeEventListener('keydown', onKey); };
  }, []);
  function switchTheme() {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    try { localStorage.setItem('journal-theme', next); } catch {}
    document.documentElement.dataset.theme = next === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
  }
  return <header className="site-header">
    <div className="header-inner shell">
      <a className="brand" href="/" aria-label="大鹏的日记首页">大鹏的日记<span className="brand-star" aria-hidden="true">✳</span></a>
      <span className="header-caption">@HEDAPENG <span>—</span> A PERSONAL JOURNAL</span>
      <nav className="desktop-nav" aria-label="主导航">{nav.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav>
      <div className="header-actions">
        <a className="search-shortcut" href="/archive/#search" aria-label="搜索文章"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></a>
        <button className="theme-toggle icon-button" onClick={switchTheme} aria-label={`当前主题：${labels[theme]}，切换为${labels[themes[(themes.indexOf(theme) + 1) % themes.length]]}`} data-preference={theme} type="button"><span aria-hidden="true">{theme === 'dark' ? '☾' : theme === 'light' ? '☼' : theme === 'warm' ? '☀' : '◐'}</span></button>
        <button className="menu-toggle icon-button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? '关闭导航' : '打开导航'} onClick={() => setMenuOpen(!menuOpen)} type="button"><span className={menuOpen ? 'menu-lines is-open' : 'menu-lines'} aria-hidden="true"/></button>
      </div>
    </div>
    <nav className="mobile-nav shell" id="mobile-navigation" aria-label="手机导航" hidden={!menuOpen}>{nav.map(([href, label], index) => <a href={href} key={href} onClick={() => setMenuOpen(false)}><span>0{index + 1}</span>{label}<span aria-hidden="true">↗</span></a>)}</nav>
  </header>;
}
