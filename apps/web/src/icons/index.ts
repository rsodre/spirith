export { Icon, type IconProps, makeIcon } from './Icon';
export { ICON_NAMES, type IconName } from './icons';
import { makeIcon } from './Icon';

export const LiveIcon = makeIcon('live', 'LiveIcon');
export const DoneIcon = makeIcon('done', 'DoneIcon');
export const WarningIcon = makeIcon('warning', 'WarningIcon');
export const LoadingIcon = makeIcon('loading', 'LoadingIcon');
export const ExternalIcon = makeIcon('external', 'ExternalIcon');
export const WalletIcon = makeIcon('wallet', 'WalletIcon');
