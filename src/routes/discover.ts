import { FastifyInstance } from 'fastify';
import { discoverQuery } from '../schemas';
import { db } from '../store/db';
import { findAllAvailableSlots, AvailableSlot } from '../services/availability';
import { selectBestSlot } from '../services/wokibrain';
import { toMinutes, toMinutesFromISO, toISO, SLOT_GRID_MINUTES } from '../utils/time';

interface Candidate {
  kind: 'single' | 'combo';
  tableIds: string[];
  tableNames: string[];
  minCapacity: number;
  maxCapacity: number;
  start: string;
  end: string;
}

export async function discoverRoutes(app: FastifyInstance) {
  app.get('/woki/discover', async (req, reply) => {
    const parsed = discoverQuery.safeParse(req.query);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') || 'unknown';
      return reply.status(400).send({
        error: 'invalid_request',
        field,
        message: `${field}: ${issue?.message || 'Invalid value'}`,
      });
    }

    const { restaurantId, sectorId, date, partySize, duration, windowStart, windowEnd, limit } = parsed.data;

    const restaurant = db.getRestaurant(restaurantId);
    if (!restaurant) {
      return reply.status(404).send({ error: 'not_found', message: 'Restaurant not found' });
    }

    const sector = db.getSector(sectorId);
    if (!sector || sector.restaurantId !== restaurantId) {
      return reply.status(404).send({ error: 'not_found', message: 'Sector not found' });
    }

    const windows = restaurant.windows || [];
    if (windows.length === 0) {
      return reply.status(422).send({ error: 'outside_service_window', message: 'No service windows configured' });
    }

    if (windowStart && windowEnd) {
      const reqStart = toMinutes(windowStart);
      const reqEnd = toMinutes(windowEnd);
      const intersects = windows.some(w => {
        const wStart = toMinutes(w.start);
        const wEnd = toMinutes(w.end);
        return reqStart < wEnd && reqEnd > wStart;
      });
      if (!intersects) {
        return reply.status(422).send({ error: 'outside_service_window', message: 'Requested window does not intersect service hours' });
      }
    }

    const allSlots = findAllAvailableSlots(restaurantId, sectorId, date, partySize, duration);

    let filtered = allSlots;
    if (windowStart && windowEnd) {
      const reqStart = toMinutes(windowStart);
      const reqEnd = toMinutes(windowEnd);
      filtered = allSlots.filter(s => {
        const slotStart = toMinutesFromISO(s.start);
        const slotEnd = toMinutesFromISO(s.end);
        return slotStart >= reqStart && slotEnd <= reqEnd;
      });
    }

    if (filtered.length === 0) {
      return reply.status(409).send({ error: 'no_capacity', message: 'No available slots for the requested party' });
    }

    const refTime = windowStart
      ? toISO(date, toMinutes(windowStart))
      : filtered[0].start;

    const best = selectBestSlot(filtered, partySize, refTime);

    const limited = limit ? filtered.slice(0, limit) : filtered;

    const candidates: Candidate[] = limited.map(s => ({
      kind: s.tableIds.length === 1 ? 'single' : 'combo',
      tableIds: s.tableIds as string[],
      tableNames: s.tableNames,
      minCapacity: s.minCapacity,
      maxCapacity: s.maxCapacity,
      start: s.start,
      end: s.end,
    }));

    return {
      slotMinutes: SLOT_GRID_MINUTES,
      durationMinutes: duration,
      best: best ? {
        kind: best.tableIds.length === 1 ? 'single' : 'combo',
        tableIds: best.tableIds as string[],
        tableNames: best.tableNames,
        minCapacity: best.minCapacity,
        maxCapacity: best.maxCapacity,
        start: best.start,
        end: best.end,
      } : null,
      candidates,
    };
  });
}
