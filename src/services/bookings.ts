import { v4 as uuidv4 } from 'uuid';
import { Database } from '../store/db';
import { LockManager } from '../store/locks';
import { IdempotencyStore } from '../store/idempotency';
import { MetricsStore } from '../store/metrics';
import { RestaurantId, SectorId, TableId, Booking, BookingId, ISODateTime, now } from '../domain/types';
import { createAvailabilityService } from './availability';
import { selectBestSlot } from './wokibrain';
import { toMinutes, toMinutesFromISO } from '../utils/time';

export interface CreateBookingInput {
  restaurantId: RestaurantId;
  sectorId: SectorId;
  partySize: number;
  durationMinutes: number;
  date: string;
  windowStart: string;
  windowEnd: string;
}

interface BookingServiceDeps {
  db: Database;
  lockManager: LockManager;
  idempotencyStore: IdempotencyStore;
  metrics: MetricsStore;
}

export type BookingService = ReturnType<typeof createBookingService>;

export function createBookingService(deps: BookingServiceDeps) {
  const { db, lockManager, idempotencyStore, metrics } = deps;
  const availabilityService = createAvailabilityService(db);

  async function createBooking(input: CreateBookingInput, idempotencyKey?: string): Promise<Booking> {
    if (idempotencyKey) {
      const cached = idempotencyStore.get<Booking>(idempotencyKey);
      if (cached) return cached;
    }

    const restaurant = db.getRestaurant(input.restaurantId);
    if (!restaurant) {
      const err = new Error('Restaurant not found');
      (err as any).code = 'not_found';
      (err as any).statusCode = 404;
      throw err;
    }

    const sector = db.getSector(input.sectorId);
    if (!sector || sector.restaurantId !== input.restaurantId) {
      const err = new Error('Sector not found');
      (err as any).code = 'not_found';
      (err as any).statusCode = 404;
      throw err;
    }

    const windows = restaurant.windows || [];
    if (windows.length === 0) {
      const err = new Error('No service windows configured');
      (err as any).code = 'outside_service_window';
      (err as any).statusCode = 422;
      throw err;
    }

    const reqStart = toMinutes(input.windowStart);
    const reqEnd = toMinutes(input.windowEnd);
    const intersects = windows.some(w => {
      const wStart = toMinutes(w.start);
      const wEnd = toMinutes(w.end);
      return reqStart < wEnd && reqEnd > wStart;
    });

    if (!intersects) {
      const err = new Error('Requested window does not intersect service hours');
      (err as any).code = 'outside_service_window';
      (err as any).statusCode = 422;
      throw err;
    }

    const allSlots = availabilityService.findAllAvailableSlots(
      input.restaurantId,
      input.sectorId,
      input.date,
      input.partySize,
      input.durationMinutes
    );

    const slots = allSlots.filter(s => {
      const slotStart = toMinutesFromISO(s.start);
      const slotEnd = toMinutesFromISO(s.end);
      return slotStart >= reqStart && slotEnd <= reqEnd;
    });

    if (slots.length === 0) {
      metrics.incConflict();
      const err = new Error('No available slots for the requested party');
      (err as any).code = 'no_capacity';
      (err as any).statusCode = 409;
      throw err;
    }

    const selected = selectBestSlot(slots, input.partySize, `${input.date}T${input.windowStart}:00Z`);
    if (!selected) {
      metrics.incConflict();
      const err = new Error('No suitable slot found');
      (err as any).code = 'no_capacity';
      (err as any).statusCode = 409;
      throw err;
    }

    const startTime = Date.now();

    const booking = await lockManager.acquire(
      input.sectorId,
      selected.tableIds as TableId[],
      selected.start as ISODateTime,
      async () => {
        const current = availabilityService.findAllAvailableSlots(
          input.restaurantId,
          input.sectorId,
          input.date,
          input.partySize,
          input.durationMinutes
        );

        const stillAvailable = current.some(
          s => s.start === selected.start && s.tableIds.every(id => selected.tableIds.includes(id))
        );

        if (!stillAvailable) {
          metrics.incConflict();
          const err = new Error('Selected slot is no longer available');
          (err as any).code = 'no_capacity';
          (err as any).statusCode = 409;
          throw err;
        }

        const newBooking: Booking = {
          id: uuidv4() as BookingId,
          restaurantId: input.restaurantId,
          sectorId: input.sectorId,
          tableIds: selected.tableIds as TableId[],
          partySize: input.partySize,
          start: selected.start as ISODateTime,
          end: selected.end as ISODateTime,
          durationMinutes: input.durationMinutes,
          status: 'CONFIRMED',
          createdAt: now(),
          updatedAt: now(),
        };

        const created = db.createBooking(newBooking);

        if (idempotencyKey) {
          idempotencyStore.set(idempotencyKey, created);
        }

        metrics.incCreated();
        return created;
      }
    );

    metrics.recordAssignmentTime(Date.now() - startTime);
    return booking;
  }

  async function deleteBooking(id: BookingId): Promise<void> {
    const booking = db.getBooking(id);
    if (!booking) {
      const err = new Error('Booking not found');
      (err as any).code = 'not_found';
      (err as any).statusCode = 404;
      throw err;
    }

    const result = db.updateBooking(id, { status: 'CANCELLED' });
    if (!result) {
      const err = new Error('Failed to delete booking');
      (err as any).code = 'internal_error';
      (err as any).statusCode = 500;
      throw err;
    }

    metrics.incCancelled();
  }

  return { createBooking, deleteBooking };
}
