import type { Address } from 'viem';
import { APP_ENV } from './chain';

// Every off-site destination the app links to, in one place. The ENS app and explorer depend
// on the environment: the hackathon apps serve only the hackathon deployment, app.ens.dev and
// explorer.ens.dev only the beta (core's ENS_LINKS).
export const REPO_URL = 'https://github.com/rsodre/spirith';
export const REPO_TREE = `${REPO_URL}/tree/main`;
// One Studio subgraph per chain; each environment is a version of it (v0.2.0 beta, v0.3.0 hackathon).
export const SUBGRAPH_STUDIO_URL = `https://thegraph.com/studio/subgraph/spirith-${APP_ENV.chain.name}`;

export const ENS_APP_URL = APP_ENV.links.app;
export const ENS_EXPLORER_URL = APP_ENV.links.explorer;
/** Link text for the explorer, e.g. "explorer.ens.dev". */
export const ENS_EXPLORER_HOST = new URL(ENS_EXPLORER_URL).host;

/** The ENS app's page for a name, where its owner registers, migrates or manages it. */
export function ensManagerName(label: string): string {
  return APP_ENV.links.manage(label);
}

/** The ENS explorer's page for a name: records, history, resolver. */
export function ensExplorerName(label: string): string {
  return APP_ENV.links.explorerName(label);
}

/** The ENS explorer's page for an account: the names it owns. */
export function ensExplorerAddress(address: Address): string {
  return APP_ENV.links.explorerAddress(address);
}
