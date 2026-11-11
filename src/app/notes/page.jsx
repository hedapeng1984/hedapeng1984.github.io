import { getEntries } from '../../lib/entries.mjs';
import CollectionPage from '../../components/CollectionPage';
export const metadata = { title: '阅读笔记', alternates: { canonical: '/notes/' } };
export default function NotesPage() { return <CollectionPage entries={getEntries().filter(entry => entry.kind === 'note')} label="§ 02 · READING NOTES" title="读过之后，留一点注脚。" description="从一篇文章、一场演讲开始。整理读到的内容，也留下一些尚未定形的想法。"/>; }
