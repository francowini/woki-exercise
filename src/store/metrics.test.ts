import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from './db';
import { MetricsStore } from './metrics';
import { LockManager } from './locks';
import { IdempotencyStore } from './idempotency';
import { createBookingService } from '../services/bookings';
import { RestaurantId, SectorId } from '../domain/types';

describe('metrics', () => {
  let db: Database;
  let metrics: MetricsStore;
  let lockManager: LockManager;
  let idempotencyStore: IdempotencyStore;
  let bookingService: ReturnType<typeof createBookingService>;

  beforeEach(() => {
    db = new Database();
    metrics = new MetricsStore();
    lockManager = new LockManager(metrics);
    idempotencyStore = new IdempotencyStore();
    bookingService = createBookingService({ db, lockManager, idempotencyStore, metrics });
  });

  it('tracks booking created count', async () => {
    const before = metrics.getSnapshot();

    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-20',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    const after = metrics.getSnapshot();
    expect(after.bookings.created).toBe(before.bookings.created + 1);
  });

  it('tracks booking cancelled count', async () => {
    const booking = await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-21',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    const before = metrics.getSnapshot();
    await bookingService.deleteBooking(booking.id);
    const after = metrics.getSnapshot();

    expect(after.bookings.cancelled).toBe(before.bookings.cancelled + 1);
  });

  it('tracks lock acquisitions', async () => {
    const before = metrics.getSnapshot();

    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-22',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    const after = metrics.getSnapshot();
    expect(after.locks.acquired).toBe(before.locks.acquired + 1);
  });

  it('records assignment timing', async () => {
    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-23',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.timing.sampleCount).toBeGreaterThan(0);
  });

  it('tracks conflicts on no capacity', async () => {
    const before = metrics.getSnapshot();

    try {
      await bookingService.createBooking({
        restaurantId: 'R1' as RestaurantId,
        sectorId: 'S1' as SectorId,
        partySize: 100,
        durationMinutes: 60,
        date: '2025-12-24',
        windowStart: '12:00',
        windowEnd: '14:00',
      });
    } catch {
      // expected
    }

    const after = metrics.getSnapshot();
    expect(after.bookings.conflicts).toBe(before.bookings.conflicts + 1);
  });
});
