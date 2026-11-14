import { getEntries } from '../../lib/entries.mjs';
import CollectionPage from '../../components/CollectionPage';
export const metadata = { title: '笔记', alternates: { canonical: '/notes/' } };
export default function NotesPage() { return <CollectionPage entries={getEntries().filter(entry => entry.kind === 'note')} label="§ 02 · NOTES" title="读过的，和自己写的。" description="从一篇文章、一场演讲开始。整理读到的内容，也留下自己写下的、还没想明白的部分。"/>; }
