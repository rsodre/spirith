// SpirithVault: endowments, patrons and the renewals Spirith paid for.
import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import {
  Endowed,
  Renewed,
  WithdrawRequested,
  Withdrawn,
} from '../generated/SpirithVault/SpirithVault';
import {
  Endowment,
  EndowmentEvent,
  Name,
  Patron,
  Patronage,
  RenewalEvent,
} from '../generated/schema';
import { ZERO, eventId, namespace } from './shared';

function patron(address: Bytes): Patron {
  let p = Patron.load(address);
  if (p == null) {
    p = new Patron(address);
    p.contributed = ZERO;
    p.withdrawn = ZERO;
    p.namesSupported = 0;
  }
  return p;
}

function patronage(endowment: Endowment, patron: Patron, timestamp: BigInt): Patronage {
  const id = endowment.id.concat(patron.id);
  let pos = Patronage.load(id);
  if (pos == null) {
    pos = new Patronage(id);
    pos.endowment = endowment.id;
    pos.patron = patron.id;
    pos.shares = ZERO;
    pos.contributed = ZERO;
    pos.withdrawn = ZERO;
    pos.noticeShares = ZERO;
  }
  pos.updatedAt = timestamp;
  return pos;
}

function endowment(labelHash: Bytes): Endowment | null {
  return Endowment.load(labelHash);
}

/** Principal never reads below zero: a withdrawal may carry yield out with it. */
function floorZero(value: BigInt): BigInt {
  return value.lt(ZERO) ? ZERO : value;
}

export function handleEndowed(event: Endowed): void {
  const ns = namespace();
  const ts = event.block.timestamp;
  const id = event.params.labelHash;

  let e = Endowment.load(id);
  if (e == null) {
    e = new Endowment(id);
    e.name = id;
    e.label = event.params.label;
    e.contributed = ZERO;
    e.withdrawn = ZERO;
    e.spent = ZERO;
    e.tipsPaid = ZERO;
    e.principal = ZERO;
    e.shares = ZERO;
    e.patronCount = 0;
    e.renewals = 0;
    e.recordWritten = false;
    e.createdAt = ts;
    const name = Name.load(id);
    if (name != null) {
      name.endowment = e.id;
      name.updatedAt = ts;
      name.save();
    }
  }
  if (e.shares.equals(ZERO)) ns.endowedNames += 1;

  const p = patron(event.params.patron);
  const pos = patronage(e, p, ts);
  if (pos.shares.equals(ZERO)) {
    e.patronCount += 1;
    p.namesSupported += 1;
  }
  pos.shares = pos.shares.plus(event.params.shares);
  pos.contributed = pos.contributed.plus(event.params.assets);
  pos.save();

  p.contributed = p.contributed.plus(event.params.assets);
  p.save();

  e.contributed = e.contributed.plus(event.params.assets);
  e.principal = e.principal.plus(event.params.assets);
  e.shares = e.shares.plus(event.params.shares);
  e.updatedAt = ts;
  e.save();

  const ev = new EndowmentEvent(eventId(event));
  ev.endowment = e.id;
  ev.patron = p.id;
  ev.kind = 'Endowed';
  ev.shares = event.params.shares;
  ev.assets = event.params.assets;
  ev.timestamp = ts;
  ev.block = event.block.number;
  ev.txHash = event.transaction.hash;
  ev.save();

  ns.endowedVolume = ns.endowedVolume.plus(event.params.assets);
  ns.principal = ns.principal.plus(event.params.assets);
  ns.updatedAt = ts;
  ns.save();
}

export function handleWithdrawRequested(event: WithdrawRequested): void {
  const e = endowment(event.params.labelHash);
  if (e == null) return;
  const ts = event.block.timestamp;
  const p = patron(event.params.patron);
  const pos = patronage(e, p, ts);
  pos.noticeShares = event.params.shares;
  pos.noticeExecutableAt = event.params.executableAt;
  pos.save();

  const ev = new EndowmentEvent(eventId(event));
  ev.endowment = e.id;
  ev.patron = p.id;
  ev.kind = 'WithdrawRequested';
  ev.shares = event.params.shares;
  ev.executableAt = event.params.executableAt;
  ev.timestamp = ts;
  ev.block = event.block.number;
  ev.txHash = event.transaction.hash;
  ev.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  const e = endowment(event.params.labelHash);
  if (e == null) return;
  const ns = namespace();
  const ts = event.block.timestamp;
  const p = patron(event.params.patron);
  const pos = patronage(e, p, ts);

  pos.shares = floorZero(pos.shares.minus(event.params.shares));
  pos.withdrawn = pos.withdrawn.plus(event.params.assets);
  pos.noticeShares = ZERO;
  pos.noticeExecutableAt = null;
  pos.save();

  if (pos.shares.equals(ZERO)) {
    e.patronCount -= 1;
    p.namesSupported -= 1;
  }
  p.withdrawn = p.withdrawn.plus(event.params.assets);
  p.save();

  const principalBefore = e.principal;
  e.shares = floorZero(e.shares.minus(event.params.shares));
  e.withdrawn = e.withdrawn.plus(event.params.assets);
  e.principal = floorZero(e.principal.minus(event.params.assets));
  e.updatedAt = ts;
  e.save();

  const ev = new EndowmentEvent(eventId(event));
  ev.endowment = e.id;
  ev.patron = p.id;
  ev.kind = 'Withdrawn';
  ev.shares = event.params.shares;
  ev.assets = event.params.assets;
  ev.timestamp = ts;
  ev.block = event.block.number;
  ev.txHash = event.transaction.hash;
  ev.save();

  if (e.shares.equals(ZERO)) ns.endowedNames -= 1;
  ns.principal = ns.principal.minus(principalBefore.minus(e.principal));
  ns.updatedAt = ts;
  ns.save();
}

export function handleRenewed(event: Renewed): void {
  const ns = namespace();
  const ts = event.block.timestamp;
  const id = event.params.labelHash;
  const paid = event.params.price.plus(event.params.tip);

  // ETHRegistrar.NameRenewed fired earlier in this transaction and created the row.
  const renewalId = event.transaction.hash.concat(id);
  let renewal = RenewalEvent.load(renewalId);
  if (renewal == null) {
    renewal = new RenewalEvent(renewalId);
    renewal.name = id;
    renewal.duration = event.params.duration;
    renewal.newExpiry = event.params.newExpiry;
    renewal.amount = event.params.price;
    renewal.paymentToken = Bytes.empty();
    renewal.referrer = Bytes.empty();
    renewal.timestamp = ts;
    renewal.block = event.block.number;
    renewal.txHash = event.transaction.hash;
  }
  renewal.viaSpirith = true;
  renewal.keeper = event.params.keeper;
  renewal.tip = event.params.tip;
  renewal.recordWritten = event.params.recordWritten;
  renewal.save();

  const e = endowment(id);
  if (e != null) {
    const principalBefore = e.principal;
    e.spent = e.spent.plus(paid);
    e.tipsPaid = e.tipsPaid.plus(event.params.tip);
    e.principal = floorZero(e.principal.minus(paid));
    e.renewals += 1;
    e.lastRenewedAt = ts;
    e.recordWritten = event.params.recordWritten;
    e.updatedAt = ts;
    e.save();
    ns.principal = ns.principal.minus(principalBefore.minus(e.principal));
  }

  ns.spirithRenewals += 1;
  ns.renewalSpend = ns.renewalSpend.plus(event.params.price);
  ns.tipsPaid = ns.tipsPaid.plus(event.params.tip);
  ns.updatedAt = ts;
  ns.save();
}
