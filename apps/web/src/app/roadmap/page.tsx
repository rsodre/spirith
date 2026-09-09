import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Metadata } from 'next';
import { RoadmapPage } from '@/components/pages/roadmap/RoadmapPage';

export const metadata: Metadata = { title: 'Roadmap' };

// The submission-facing roadmap lives in specs/; this route is its only renderer. Next runs
// from the app directory, so the workspace root is two levels up.
const ROADMAP = resolve(process.cwd(), '../../specs/SPIRITH_ROADMAP.md');

/** The spec cross-references the handover, which is not on the site; drop those pointers. */
function stripSpecReferences(markdown: string): string {
  return markdown
    .replace(/\s*\(→ HANDOVER[^)]*\)/g, '')
    .replace(/[^.\n]*HANDOVER[^.\n]*\.\s*/g, '');
}

export default async function Page() {
  const markdown = stripSpecReferences(await readFile(ROADMAP, 'utf8'));
  return <RoadmapPage markdown={markdown} />;
}
