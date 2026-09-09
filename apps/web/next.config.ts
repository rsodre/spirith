import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// One `.env` for the whole workspace, at the repo root. Next reads only the app's own
// directory, so the root profile is loaded here; values already in the environment win.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  // The agent's dev server (`dev:claude`) builds into its own directory so it never races the
  // user's `next dev` for `.next/`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // The repo's agent docs live at the root; Next must not write its own beside the app.
  agentRules: false,
};

export default config;
