import { ensContract, spirithContract, type ChainConfig } from '@spirith/core';
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export interface RenewOnceInput {
  readonly chain: ChainConfig;
  readonly rpcUrl: string;
  readonly label: string;
  /** Simulate only; never send. */
  readonly dryRun: boolean;
  readonly keeperPrivateKey: Hex | undefined;
}

export type RenewOnceResult =
  | { readonly status: 'not-due'; readonly expiry: bigint; readonly dueAt: bigint }
  | { readonly status: 'unfunded'; readonly assets: bigint }
  | {
      readonly status: 'simulated';
      readonly duration: bigint;
      readonly price: bigint;
      readonly tip: bigint;
    }
  | {
      readonly status: 'sent';
      readonly duration: bigint;
      readonly price: bigint;
      readonly tip: bigint;
      readonly hash: Hex;
    };

const SIMULATION_ACCOUNT: Address = '0x0000000000000000000000000000000000000001';

/**
 * One keeper attempt for one name: read the vault's view of the name, simulate `renew`, and
 * send it unless dry-running. Pure over its inputs apart from the chain; no process.env here.
 */
export async function renewOnce(input: RenewOnceInput): Promise<RenewOnceResult> {
  const publicClient = createPublicClient({
    chain: input.chain.chain,
    transport: http(input.rpcUrl),
  });
  const vault = spirithContract(input.chain.name, 'spirithVault');
  const registry = ensContract(input.chain.name, 'ethRegistry');

  const [expiry, lead, runway] = await Promise.all([
    publicClient.readContract({ ...registry, functionName: 'findExpiry', args: [input.label] }),
    publicClient.readContract({ ...vault, functionName: 'RENEW_LEAD' }),
    publicClient.readContract({ ...vault, functionName: 'runwayOf', args: [input.label] }),
  ]);
  const [, , assets, duration] = runway;
  if (duration === 0n) return { status: 'unfunded', assets };
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (expiry > now + lead) return { status: 'not-due', expiry, dueAt: expiry - lead };

  const account = input.keeperPrivateKey ? privateKeyToAccount(input.keeperPrivateKey) : undefined;
  const { request, result } = await publicClient.simulateContract({
    ...vault,
    functionName: 'renew',
    args: [input.label, duration],
    account: account ?? SIMULATION_ACCOUNT,
  });
  const [price, tip] = result;
  if (input.dryRun || account === undefined) return { status: 'simulated', duration, price, tip };

  const walletClient = createWalletClient({
    account,
    chain: input.chain.chain,
    transport: http(input.rpcUrl),
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`renew reverted in ${hash}`);
  return { status: 'sent', duration, price, tip, hash };
}
