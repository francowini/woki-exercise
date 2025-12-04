import { ISODateTime, now } from '../domain/types';

type IdempotencyKey = string & { readonly __idempotencyKey: unique symbol };

interface IdempotencyEntry<T> {
  response: T;
  expiresAt: ISODateTime;
}

export class IdempotencyStore {
  private entries = new Map<IdempotencyKey, IdempotencyEntry<any>>();
  private readonly ttl = 60;

  get<T>(key: string): T | undefined {
    const k = key.trim() as IdempotencyKey;
    const entry = this.entries.get(k);

    if (!entry) return undefined;

    if (now() > entry.expiresAt) {
      this.entries.delete(k);
      return undefined;
    }

    return entry.response as T;
  }

  set<T>(key: string, response: T): void {
    const k = key.trim() as IdempotencyKey;
    const expiresAt = new Date(Date.now() + this.ttl * 1000).toISOString() as ISODateTime;
    this.entries.set(k, { response, expiresAt });
  }

  clear(): void {
    this.entries.clear();
  }
}
