// Every off-site destination the app links to, in one place.
export const REPO_URL = 'https://github.com/rsodre/spirith';
export const REPO_TREE = `${REPO_URL}/tree/main`;
export const SUBGRAPH_STUDIO_URL = 'https://thegraph.com/studio/subgraph/spirith-sepolia';
export const ENS_MANAGER_URL = 'https://manager.ens.dev';

/** The beta manager's page for a name, where its owner migrates or manages it. */
export function ensManagerName(label: string): string {
  return `${ENS_MANAGER_URL}/name/${label}.eth`;
}
export const ENS_EXPLORER_URL = 'https://explorer.ens.dev';
