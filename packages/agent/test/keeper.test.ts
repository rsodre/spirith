import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

describe('loadEnv', () => {
  it('defaults to sepolia and needs an RPC url', () => {
    const env = loadEnv({ SEPOLIA_RPC_URL: 'http://localhost:8545' });
    expect(env.chain.name).toBe('sepolia');
    expect(env.keeperPrivateKey).toBeUndefined();
    expect(() => loadEnv({})).toThrow('SEPOLIA_RPC_URL');
    expect(() => loadEnv({ SPIRITH_CHAIN: 'mars', SEPOLIA_RPC_URL: 'x' })).toThrow('unknown chain');
  });

  it('only accepts a 0x-prefixed keeper key', () => {
    expect(
      loadEnv({ SEPOLIA_RPC_URL: 'x', KEEPER_PRIVATE_KEY: 'abc' }).keeperPrivateKey,
    ).toBeUndefined();
    expect(loadEnv({ SEPOLIA_RPC_URL: 'x', KEEPER_PRIVATE_KEY: '0xabc' }).keeperPrivateKey).toBe(
      '0xabc',
    );
  });
});
