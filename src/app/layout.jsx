import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/noto-serif-sc';
import './tokens.css';
import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { site } from '../lib/site.mjs';

export const metadata = {
  metadataBase: new URL(site.url),
  title: { default: '生长 · 写下此刻，留给以后', template: '%s · 生长' },
  description: site.description,
  generator: 'Next.js',
  robots: { index: !site.trial, follow: !site.trial },
  icons: { icon: '/favicon.svg' },
  openGraph: { title: site.name, description: site.description, siteName: site.name, locale: 'zh_CN', type: 'website' },
  alternates: { types: { 'application/rss+xml': '/rss.xml' } },
};
const themeScript = `(function(){try{var p=localStorage.getItem('journal-theme')||'system';if(!['light','dark','warm','system'].includes(p))p='system';document.documentElement.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;}catch(e){}})();`;

export default function RootLayout({ children }) {
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/><meta name="color-scheme" content="light dark"/></head><body><a className="skip-link" href="#main">跳到正文</a><Header/><main id="main">{children}</main><Footer/></body></html>;
}
