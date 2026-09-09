// Thin GraphQL-over-fetch client for the Spirith subgraph. No dependency: `fetch` is global in
// Node 18+ and every browser. Studio and gateway endpoints both take POST with a JSON body;
// the gateway wants the API key as a bearer token, Studio's dev endpoint takes none.

export interface SubgraphConfig {
  /** Studio query URL, `https://api.studio.thegraph.com/query/<id>/spirith-sepolia/<version>`. */
  readonly url: string;
  /** Gateway API key; omitted for a Studio dev endpoint. */
  readonly apiKey?: string;
  readonly fetch?: typeof fetch;
}

export class SubgraphError extends Error {
  constructor(
    message: string,
    readonly errors: readonly { message: string }[] = [],
  ) {
    super(message);
    this.name = 'SubgraphError';
  }
}

interface GraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: readonly { message: string }[];
}

export async function querySubgraph<T>(
  config: SubgraphConfig,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const doFetch = config.fetch ?? fetch;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  const response = await doFetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new SubgraphError(`subgraph responded ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new SubgraphError(body.errors.map(e => e.message).join('; '), body.errors);
  }
  if (body.data === undefined) throw new SubgraphError('subgraph returned no data');
  return body.data;
}
