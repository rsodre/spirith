import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

describe('loadEnv', () => {
  it('defaults to the hackathon environment and needs its RPC url', () => {
    const env = loadEnv({ SEPOLIA_RPC_URL: 'http://localhost:8545' });
    expect(env.environment.name).toBe('hackathon');
    expect(env.chain.name).toBe('sepolia');
    expect(env.keeperPrivateKey).toBeUndefined();
    expect(() => loadEnv({})).toThrow('SEPOLIA_RPC_URL');
    expect(() => loadEnv({ SPIRITH_ENV: 'mars', SEPOLIA_RPC_URL: 'x' })).toThrow(
      'unknown environment',
    );
    expect(loadEnv({ SPIRITH_ENV: 'sepolia', SEPOLIA_RPC_URL: 'x' }).environment.name).toBe(
      'sepolia',
    );
    expect(() => loadEnv({ SPIRITH_ENV: 'mainnet', SEPOLIA_RPC_URL: 'x' })).toThrow(
      'MAINNET_RPC_URL',
    );
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
