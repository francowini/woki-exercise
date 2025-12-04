import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../store/db';
import { MetricsStore } from '../store/metrics';
import { LockManager } from '../store/locks';
import { IdempotencyStore } from '../store/idempotency';
import { createBookingService } from './bookings';
import { RestaurantId, SectorId, BookingId } from '../domain/types';

describe('createBooking', () => {
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

  it('books single table for party that fits', async () => {
    const booking = await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 5,
      durationMinutes: 90,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:00',
    });

    expect(booking.status).toBe('CONFIRMED');
    expect(booking.tableIds).toHaveLength(1);
    expect(['T4', 'T5']).toContain(booking.tableIds[0]);
  });

  it('books combo when party exceeds single table capacity', async () => {
    const booking = await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 10,
      durationMinutes: 60,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:00',
    });

    expect(booking.status).toBe('CONFIRMED');
    expect(booking.tableIds.length).toBeGreaterThan(1);
  });

  it('allows adjacent bookings (end-exclusive)', async () => {
    const first = await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '13:00',
    });

    const second = await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-15',
      windowStart: '13:00',
      windowEnd: '14:00',
    });

    expect(first.end).toBe(second.start);
    expect(second.status).toBe('CONFIRMED');
  });

  it('returns same booking with same idempotency key', async () => {
    const input = {
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 4,
      durationMinutes: 90,
      date: '2025-12-15',
      windowStart: '20:00',
      windowEnd: '23:00',
    };
    const key = 'idem-key-123';

    const first = await bookingService.createBooking(input, key);
    const second = await bookingService.createBooking(input, key);

    expect(first.id).toBe(second.id);
    expect(first.tableIds).toEqual(second.tableIds);
  });

  it('one wins when two requests race for same slot', async () => {
    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 5,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });
    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 5,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });
    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });
    await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });

    const input = {
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    };

    const results = await Promise.allSettled([
      bookingService.createBooking(input),
      bookingService.createBooking(input),
    ]);

    const ok = results.filter(r => r.status === 'fulfilled');
    const fail = results.filter(r => r.status === 'rejected');

    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
  });

  it('rejects window outside service hours with 422', async () => {
    try {
      await bookingService.createBooking({
        restaurantId: 'R1' as RestaurantId,
        sectorId: 'S1' as SectorId,
        partySize: 2,
        durationMinutes: 60,
        date: '2025-12-15',
        windowStart: '16:00',
        windowEnd: '18:00',
      });
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('outside_service_window');
    }
  });
});

describe('deleteBooking', () => {
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

  it('cancels existing booking', async () => {
    const booking = await bookingService.createBooking({
      restaurantId: 'R1' as RestaurantId,
      sectorId: 'S1' as SectorId,
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    await bookingService.deleteBooking(booking.id);

    const updated = db.getBooking(booking.id);
    expect(updated?.status).toBe('CANCELLED');
  });

  it('throws 404 for non-existent booking', async () => {
    try {
      await bookingService.deleteBooking('bogus-id' as BookingId);
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('not_found');
    }
  });
});
