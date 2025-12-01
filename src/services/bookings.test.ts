import { describe, it, expect, beforeEach } from 'vitest';
import { createBooking, deleteBooking } from './bookings';
import { db } from '../store/db';
import { idempotencyStore } from '../store/idempotency';
import { SectorId, BookingId } from '../domain/types';

function clearBookings() {
  const all = db.getBookingsBySector('S1' as SectorId);
  for (const b of all) {
    db.updateBooking(b.id, { status: 'CANCELLED' });
  }
}

describe('createBooking', () => {
  beforeEach(() => {
    clearBookings();
    idempotencyStore.clear();
  });

  it('books single table for party that fits', async () => {
    const booking = await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
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
    const booking = await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
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
    const first = await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '13:00',
    });

    const second = await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
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
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 4,
      durationMinutes: 90,
      date: '2025-12-15',
      windowStart: '20:00',
      windowEnd: '23:00',
    };
    const key = 'idem-key-123';

    const first = await createBooking(input, key);
    const second = await createBooking(input, key);

    expect(first.id).toBe(second.id);
    expect(first.tableIds).toEqual(second.tableIds);
  });

  it('one wins when two requests race for same slot', async () => {
    // Book 4 tables first, leaving only 1 available
    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 5,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });
    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 5,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });
    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 2,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });
    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 2,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    });

    // Now race for the last table
    const input = {
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 2,
      durationMinutes: 180,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '15:30',
    };

    const results = await Promise.allSettled([
      createBooking(input),
      createBooking(input),
    ]);

    const ok = results.filter(r => r.status === 'fulfilled');
    const fail = results.filter(r => r.status === 'rejected');

    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
  });

  it('rejects window outside service hours with 422', async () => {
    try {
      await createBooking({
        restaurantId: 'R1',
        sectorId: 'S1',
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
  beforeEach(() => {
    clearBookings();
    idempotencyStore.clear();
  });

  it('cancels existing booking', async () => {
    const booking = await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-15',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    await deleteBooking(booking.id);

    const updated = db.getBooking(booking.id as BookingId);
    expect(updated?.status).toBe('CANCELLED');
  });

  it('throws 404 for non-existent booking', async () => {
    try {
      await deleteBooking('bogus-id');
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('not_found');
    }
  });
});
