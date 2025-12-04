import { SectorId, TableId, ISODateTime } from '../domain/types';
import { MetricsStore } from './metrics';

type LockKey = string & { readonly __lockKey: unique symbol };

export class LockManager {
  private locks = new Map<LockKey, Promise<void>>();

  constructor(private metrics: MetricsStore) {}

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
    if (existing) {
      this.metrics.incLockWait();
      await existing;
    }

    this.metrics.incLockAcquired();

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
