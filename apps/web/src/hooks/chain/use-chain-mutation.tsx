'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  TransactionReceipt,
} from 'viem';
import {
  getAccount,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions';
import { ElapsedTimeBadge } from '@/components/ElapsedTimeBadge';
import { TxLink } from '@/components/AddressLink';
import { fetchNamespaceQuery } from '@/hooks/queries/use-namespace';
import { handleApiError } from '@/lib/client-utils';
import { wagmiConfig } from '@/lib/wagmi';

// The transaction runner every write hook is built on (`web3-chain-layer` § Writes, Toasts).
// The lifecycle lives inside mutationFn and one toast morphs at one id: sent → hash → confirmed
// → indexed, or failed with the revert reason. A write is never "done" on wallet acceptance;
// every send awaits the receipt and throws on a revert. Invalidation is this hook's job.

let counter = 0;

export interface SendResult<TResult> {
  readonly hash: `0x${string}`;
  readonly receipt: TransactionReceipt;
  /** The simulated return value, for calls whose result the flow needs (a deployed address). */
  readonly result: TResult;
}

export interface TxRunner {
  readonly account: Address;
  /** Simulate, send, await the receipt. `step` labels the toast while this call is in flight. */
  send<
    const TAbi extends Abi,
    TName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TName>,
  >(
    step: string,
    params: { address: Address; abi: TAbi; functionName: TName; args: TArgs },
  ): Promise<SendResult<unknown>>;
  /** Wait until the subgraph has indexed `block`. Resolves false when it stays behind. */
  indexing(block: bigint): Promise<boolean>;
}

export interface ChainMutationOptions<TArgs, TResult> {
  onSuccess?: (result: TResult, args: TArgs) => void;
}

const INDEXING_POLL_MS = 4_000;
const INDEXING_MAX_POLLS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useChainMutation<TArgs, TResult>(
  name: string,
  run: (tx: TxRunner, args: TArgs) => Promise<TResult>,
  options: ChainMutationOptions<TArgs, TResult> = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs): Promise<TResult> => {
      counter += 1;
      const toastId = `${name}-${counter}`;
      const startedAt = Date.now();
      const account = getAccount(wagmiConfig).address;
      if (!account) throw new Error('Connect a wallet first.');

      const show = (step: string, detail?: React.ReactNode) =>
        toast.loading(<span>{name}</span>, {
          id: toastId,
          description: (
            <span className="flex items-center gap-2">
              <span>{step}</span>
              {detail}
              <ElapsedTimeBadge startedAt={startedAt} />
            </span>
          ),
        });

      const tx: TxRunner = {
        account,
        async send(step, params) {
          show(`${step} — confirm in your wallet`);
          const { request, result } = await simulateContract(wagmiConfig, {
            ...params,
            account,
          } as Parameters<typeof simulateContract>[1]);
          const hash = await writeContract(wagmiConfig, request);
          show(`${step} — sent`, <TxLink hash={hash} />);
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
          if (receipt.status === 'reverted') throw new Error(`${step} reverted (${hash})`);
          return { hash, receipt, result };
        },
        async indexing(block) {
          for (let i = 0; i < INDEXING_MAX_POLLS; i++) {
            show('confirmed — waiting for the index');
            try {
              const { meta } = await fetchNamespaceQuery();
              if (BigInt(meta.block) >= block) return true;
            } catch {}
            await sleep(INDEXING_POLL_MS);
          }
          return false;
        },
      };

      try {
        const result = await run(tx, args);
        toast.success(<span>{name}</span>, {
          id: toastId,
          description: 'confirmed',
          duration: 6_000,
        });
        return result;
      } catch (error) {
        handleApiError(name, args, error, { toastId });
        throw error;
      } finally {
        // Chain reads (wagmi keys them with one object) and subgraph queries alike.
        void queryClient.invalidateQueries();
      }
    },
    onSuccess: options.onSuccess,
  });
}
