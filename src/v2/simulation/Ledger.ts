import type { LedgerEntry, LedgerEntryKind } from './types';
import type { RoomId } from '../content/rooms';

export type LedgerPost = Readonly<{
  tick: number;
  kind: Exclude<LedgerEntryKind, 'opening_balance'>;
  amount: number;
  sourceId: string;
  guestId?: string;
  roomId?: RoomId;
}>;

export class Ledger {
  private balanceValue = 0;
  private sequence = 0;
  private readonly entriesValue: LedgerEntry[] = [];

  constructor(initialBalance: number) {
    if (!Number.isInteger(initialBalance) || initialBalance < 0) {
      throw new Error(`Initial balance must be a non-negative integer, received ${initialBalance}.`);
    }
    this.balanceValue = initialBalance;
    if (initialBalance > 0) {
      this.entriesValue.push({
        id: `ledger-${++this.sequence}`,
        tick: 0,
        kind: 'opening_balance',
        amount: initialBalance,
        balanceAfter: initialBalance,
        sourceId: 'new-game-capital',
      });
    }
  }

  get balance() {
    return this.balanceValue;
  }

  canAfford(cost: number) {
    return Number.isInteger(cost) && cost >= 0 && this.balanceValue >= cost;
  }

  post(posting: LedgerPost): LedgerEntry {
    if (!Number.isInteger(posting.tick) || posting.tick < 0) throw new Error(`Ledger tick must be a non-negative integer.`);
    if (!Number.isInteger(posting.amount) || posting.amount === 0) throw new Error(`Ledger amount must be a non-zero integer.`);
    const nextBalance = this.balanceValue + posting.amount;
    if (nextBalance < 0) throw new Error(`Ledger posting would make the balance negative: ${posting.sourceId}.`);
    this.balanceValue = nextBalance;
    const entry: LedgerEntry = {
      id: `ledger-${++this.sequence}`,
      tick: posting.tick,
      kind: posting.kind,
      amount: posting.amount,
      balanceAfter: nextBalance,
      sourceId: posting.sourceId,
      ...(posting.guestId ? { guestId: posting.guestId } : {}),
      ...(posting.roomId ? { roomId: posting.roomId } : {}),
    };
    this.entriesValue.push(entry);
    return { ...entry };
  }

  snapshot(): readonly LedgerEntry[] {
    return this.entriesValue.map((entry) => ({ ...entry }));
  }
}
