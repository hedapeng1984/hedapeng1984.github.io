import { getEntries } from '../../lib/entries.mjs';
import CollectionPage from '../../components/CollectionPage';
export const metadata = { title: '日常记录', alternates: { canonical: '/journal/' } };
export default function JournalPage() { return <CollectionPage entries={getEntries().filter(entry => entry.kind === 'journal')} label="§ 01 · JOURNAL" title="平常的日子，值得记下。" description="一次散步，一页书，一个终于慢下来的早晨。把经历过的生活，留在这里。"/>; }
