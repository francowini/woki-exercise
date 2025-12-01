import { describe, it, expect, beforeEach } from 'vitest';
import { createBooking, deleteBooking } from '../services/bookings';
import { db } from './db';
import { idempotencyStore } from './idempotency';
import { metrics } from './metrics';
import { SectorId } from '../domain/types';

function clearBookings() {
  const all = db.getBookingsBySector('S1' as SectorId);
  for (const b of all) {
    db.updateBooking(b.id, { status: 'CANCELLED' });
  }
}

describe('metrics', () => {
  beforeEach(() => {
    clearBookings();
    idempotencyStore.clear();
  });

  it('tracks booking created count', async () => {
    const before = metrics.getSnapshot();

    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
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
    const booking = await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
      partySize: 2,
      durationMinutes: 60,
      date: '2025-12-21',
      windowStart: '12:00',
      windowEnd: '14:00',
    });

    const before = metrics.getSnapshot();
    await deleteBooking(booking.id);
    const after = metrics.getSnapshot();

    expect(after.bookings.cancelled).toBe(before.bookings.cancelled + 1);
  });

  it('tracks lock acquisitions', async () => {
    const before = metrics.getSnapshot();

    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
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
    await createBooking({
      restaurantId: 'R1',
      sectorId: 'S1',
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
      await createBooking({
        restaurantId: 'R1',
        sectorId: 'S1',
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
