// Prints the Studio version label for SPIRITH_ENV, from core's deployments/subgraph.json, so
// `deploy:studio` publishes under the version the rest of the workspace queries.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const env = process.env.SPIRITH_ENV ?? 'hackathon';
const path = join(
  new URL('..', import.meta.url).pathname,
  '..',
  'core',
  'deployments',
  'subgraph.json',
);
const version = JSON.parse(readFileSync(path, 'utf8')).versions[env];
if (!version) throw new Error(`no subgraph version for the ${env} environment in ${path}`);
process.stdout.write(version);
