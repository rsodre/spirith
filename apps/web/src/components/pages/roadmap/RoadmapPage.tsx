import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PLUGINS = [remarkGfm];

// `specs/SPIRITH_ROADMAP.md` rendered as is, so the page can never drift from the spec. The
// route reads the file at build time and hands the text here.
export function RoadmapPage({ markdown }: { markdown: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <article className="max-w-3xl">
        <Markdown remarkPlugins={PLUGINS}>{markdown}</Markdown>
      </article>
    </main>
  );
}
