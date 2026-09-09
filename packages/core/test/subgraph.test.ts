import { describe, expect, it } from 'vitest';
import { SubgraphError, querySubgraph } from '../src/subgraph/client.js';
import { fetchNames, fetchNamesAtRisk, labelhash } from '../src/subgraph/queries.js';

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: { query: string; variables: Record<string, unknown> };
}

function fakeFetch(data: unknown, captured: Captured[] = []): typeof fetch {
  return (async (url, init) => {
    captured.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as typeof fetch;
}

const NOW = 1_800_000_000n;

describe('querySubgraph', () => {
  it('posts the query with a bearer token when an api key is given', async () => {
    const captured: Captured[] = [];
    const config = { url: 'https://x/q', apiKey: 'k', fetch: fakeFetch({ ok: 1 }, captured) };
    await expect(querySubgraph(config, '{ ok }')).resolves.toEqual({ ok: 1 });
    expect(captured[0]?.headers.authorization).toBe('Bearer k');
    expect(captured[0]?.body.query).toBe('{ ok }');
  });

  it('turns GraphQL errors into a SubgraphError', async () => {
    const fetchErr = (async () =>
      new Response(JSON.stringify({ errors: [{ message: 'boom' }] }))) as typeof fetch;
    await expect(querySubgraph({ url: 'u', fetch: fetchErr }, '{ x }')).rejects.toBeInstanceOf(
      SubgraphError,
    );
  });
});

describe('fetchNames', () => {
  const wireName = {
    id: labelhash('spirithbeta'),
    label: 'spirithbeta',
    length: 11,
    tier: 5,
    owner: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4',
    resolver: null,
    expiry: '1980000000',
    status: 'Registered',
    registeredAt: '1750000000',
    renewals: 1,
    lastRenewedAt: null,
    endowment: {
      principal: '22729929',
      shares: '50000000',
      patronCount: 1,
      renewals: 1,
      recordWritten: true,
    },
  };

  it('parses chain numerics to bigint and checksums addresses', async () => {
    const [name] = await fetchNames({ url: 'u', fetch: fakeFetch({ names: [wireName] }) });
    expect(name?.expiry).toBe(1_980_000_000n);
    expect(name?.owner).toBe('0x62d48EA396a8BD7A5627BbAB5969DD45DB2b42c4');
    expect(name?.endowment?.principal).toBe(22_729_929n);
    expect(name?.lastRenewedAt).toBeNull();
  });

  it('asks for the expiry window the gate specifies, grace included', async () => {
    const captured: Captured[] = [];
    await fetchNamesAtRisk(
      { url: 'u', fetch: fakeFetch({ names: [] }, captured) },
      NOW,
      28n * 86_400n,
    );
    expect(captured[0]?.body.variables.where).toEqual({
      status: 'Registered',
      expiry_lt: (NOW + 28n * 86_400n).toString(),
      expiry_gte: (NOW - 28n * 86_400n).toString(),
    });
  });

  it('labelhash matches the vault (keccak256 of the raw label)', () => {
    expect(labelhash('spirithbeta')).toBe(
      '0x8cb8432bc509ef709a1bc31c9985a99195c695d26b6d2d01d0764494a77e36b3',
    );
  });
});
