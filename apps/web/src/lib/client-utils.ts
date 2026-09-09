'use client';

import { toast } from 'sonner';
import { BaseError, ContractFunctionRevertedError } from 'viem';

// Error reporting for the mutation layer (`nextjs` skill part 2 §6): log enough to reproduce
// without a debugger, then one error toast. A staged operation passes its own toast id so the
// same toast follows the call from sent to failed.
export function handleApiError(
  apiName: string,
  params: unknown,
  error: unknown,
  { toastId }: { toastId?: string } = {},
): void {
  console.error('[API Error]', { apiName, params, error });
  toast.error(errorMessage(error), {
    id: toastId,
    description: apiName,
    closeButton: true,
    duration: 8000,
  });
}

/** A revert's custom error name and arguments beat viem's paragraph; a plain message beats both. */
export function errorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk(e => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data) {
      const args = reverted.data.args?.map(String).join(', ') ?? '';
      return `${reverted.data.errorName}(${args})`;
    }
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
