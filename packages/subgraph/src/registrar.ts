// ETHRegistrar: what was paid. Registration amounts and every renewal, by anyone.
import { NameRegistered, NameRenewed } from '../generated/ETHRegistrar/ETHRegistrar';
import { Name, RenewalEvent } from '../generated/schema';
import { SPIRITH_REFERRER } from './config';
import { labelhash, namespace } from './shared';

export function handleNameRegistered(event: NameRegistered): void {
  // ETHRegistry.LabelRegistered fires inside the same call, before this event.
  const name = Name.load(labelhash(event.params.label));
  if (name == null) return;
  name.registrationAmount = event.params.base.plus(event.params.premium);
  name.updatedAt = event.block.timestamp;
  name.save();
}

export function handleNameRenewed(event: NameRenewed): void {
  const id = labelhash(event.params.label);
  const name = Name.load(id);
  if (name == null) return;

  const renewal = new RenewalEvent(event.transaction.hash.concat(id));
  renewal.name = name.id;
  renewal.duration = event.params.duration;
  renewal.newExpiry = event.params.newExpiry;
  renewal.amount = event.params.amount;
  renewal.paymentToken = event.params.paymentToken;
  renewal.referrer = event.params.referrer;
  // SpirithVault.Renewed, later in the same transaction, fills in keeper and tip.
  renewal.viaSpirith = event.params.referrer.equals(SPIRITH_REFERRER);
  renewal.timestamp = event.block.timestamp;
  renewal.block = event.block.number;
  renewal.txHash = event.transaction.hash;
  renewal.save();

  name.expiry = event.params.newExpiry;
  name.renewals += 1;
  name.lastRenewedAt = event.block.timestamp;
  name.updatedAt = event.block.timestamp;
  name.save();

  const ns = namespace();
  ns.renewals += 1;
  ns.updatedAt = event.block.timestamp;
  ns.save();
}
