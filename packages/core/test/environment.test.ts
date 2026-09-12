import { describe, expect, it } from 'vitest';
import { environment } from '../src/index.js';

describe('environment', () => {
  it('derives the Studio query URL from the subgraph version of the environment', () => {
    const { subgraph } = environment('hackathon');
    expect(subgraph?.name).toBe('spirith-sepolia');
    expect(subgraph?.url).toBe(
      `https://api.studio.thegraph.com/query/1758987/spirith-sepolia/${subgraph?.version}`,
    );
    expect(subgraph?.studio).toBe('https://thegraph.com/studio/subgraph/spirith-sepolia');
  });

  it('has no subgraph where Spirith is not deployed', () => {
    expect(environment('mainnet').subgraph).toBeUndefined();
  });
});
