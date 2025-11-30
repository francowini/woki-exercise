import { SectorId, TableId, ISODateTime } from '../domain/types';

type LockKey = string & { readonly __lockKey: unique symbol };

class LockManager {
  private locks = new Map<LockKey, Promise<void>>();

  private createKey(sectorId: SectorId, tableIds: TableId[], start: ISODateTime): LockKey {
    const sortedTables = [...tableIds].sort();
    const tableStr = sortedTables.join('+');
    return `${sectorId}|${tableStr}|${start}` as LockKey;
  }

  async acquire<T>(
    sectorId: SectorId,
    tableIds: TableId[],
    start: ISODateTime,
    fn: () => Promise<T>
  ): Promise<T> {
    const key = this.createKey(sectorId, tableIds, start);

    const existing = this.locks.get(key);
    if (existing) await existing;

    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      releaseLock!();
      this.locks.delete(key);
    }
  }
}

export const lockManager = new LockManager();
