import type { ChainName } from '../chains.js';
import type { EnvName } from '../environment.js';
import subgraphs from '../../deployments/subgraph.json' with { type: 'json' };

// One Studio subgraph per chain, `spirith-<chain>`, with one version per environment; the
// version lives in deployments/subgraph.json, the single source for the query URL here and for
// the version label `deploy:studio` publishes under. A Studio query URL is public: it carries no
// credential and is rate-limited by Studio. Only a gateway URL embeds the API key, and that one
// arrives through SUBGRAPH_QUERY_URL + GRAPH_API_KEY, never from here.
export interface SubgraphEndpoint {
  readonly name: string;
  readonly version: string;
  /** The subgraph's page on Subgraph Studio, for humans. */
  readonly studio: string;
  /** The Studio query URL, for the client. */
  readonly url: string;
}

const VERSIONS: Readonly<Partial<Record<EnvName, string>>> = subgraphs.versions;

export function subgraphEndpoint(env: EnvName, chain: ChainName): SubgraphEndpoint | undefined {
  const version = VERSIONS[env];
  if (!version) return undefined;
  const name = `spirith-${chain}`;
  return {
    name,
    version,
    studio: `https://thegraph.com/studio/subgraph/${name}`,
    url: `${subgraphs.queryBase}/${name}/${version}`,
  };
}
