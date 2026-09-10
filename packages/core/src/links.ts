import type { Address } from 'viem';
import type { EnvName } from './environment.js';

// Where a name or an address is looked at off-site, per environment. The two Sepolia sets are
// served by different apps: the hackathon app and explorer serve the hackathon deployment
// exclusively, app.ens.dev and explorer.ens.dev serve the beta. Nothing on mainnet reads
// ENSv2 yet, so mainnet links go to the v1 app and to Etherscan's name lookup.
export interface EnsLinks {
  /** Origin of the ENS app that serves this environment (register, manage, migrate). */
  readonly app: string;
  /** Origin of the ENS explorer that serves this environment (records, history). */
  readonly explorer: string;
  /** The app's page for `<label>.eth`, where its owner manages it. */
  manage(label: string): string;
  /** The explorer's page for `<label>.eth`. */
  explorerName(label: string): string;
  /** The explorer's page for an account: the names it owns. */
  explorerAddress(address: Address): string;
}

function ensv2Links(app: string, explorer: string): EnsLinks {
  return {
    app,
    explorer,
    manage: label => `${app}/${label}.eth`,
    explorerName: label => `${explorer}/${label}.eth`,
    explorerAddress: address => `${explorer}/addr/${address}`,
  };
}

const MAINNET_APP = 'https://app.ens.domains';
const MAINNET_EXPLORER = 'https://etherscan.io';

export const ENS_LINKS: Readonly<Record<EnvName, EnsLinks>> = {
  hackathon: ensv2Links(
    'https://hackathon-deployment-manager-app-v4.ens-cf.workers.dev',
    'https://hackathon-deployment-portal-app.ens-cf.workers.dev',
  ),
  sepolia: ensv2Links('https://app.ens.dev', 'https://explorer.ens.dev'),
  mainnet: {
    app: MAINNET_APP,
    explorer: MAINNET_EXPLORER,
    manage: label => `${MAINNET_APP}/${label}.eth`,
    explorerName: label => `${MAINNET_EXPLORER}/name-lookup-search?id=${label}.eth`,
    explorerAddress: address => `${MAINNET_EXPLORER}/address/${address}`,
  },
};
