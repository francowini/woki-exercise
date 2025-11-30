import { FastifyInstance } from 'fastify';
import { discoverQuery } from '../schemas';
import { db } from '../store/db';
import { findAllAvailableSlots } from '../services/availability';
import { toMinutes, toMinutesFromISO, SLOT_GRID_MINUTES } from '../utils/time';

interface Candidate {
  kind: 'single' | 'combo';
  tableIds: string[];
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
        error: 'invalid_input',
        detail: `${field}: ${issue?.message || 'Invalid value'}`,
      });
    }

    const { restaurantId, sectorId, date, partySize, duration, windowStart, windowEnd, limit } = parsed.data;

    const restaurant = db.getRestaurant(restaurantId);
    if (!restaurant) {
      return reply.status(404).send({ error: 'not_found', detail: 'Restaurant not found' });
    }

    const sector = db.getSector(sectorId);
    if (!sector || sector.restaurantId !== restaurantId) {
      return reply.status(404).send({ error: 'not_found', detail: 'Sector not found' });
    }

    const windows = restaurant.windows || [];
    if (windows.length === 0) {
      return reply.status(422).send({ error: 'outside_service_window', detail: 'No service windows configured' });
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
        return reply.status(422).send({ error: 'outside_service_window', detail: 'Requested window does not intersect service hours' });
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
      return reply.status(409).send({ error: 'no_capacity', detail: 'No available slots for the requested party' });
    }

    const limited = limit ? filtered.slice(0, limit) : filtered;

    const candidates: Candidate[] = limited.map(s => ({
      kind: s.tableIds.length === 1 ? 'single' : 'combo',
      tableIds: s.tableIds as string[],
      start: s.start,
      end: s.end,
    }));

    return {
      slotMinutes: SLOT_GRID_MINUTES,
      durationMinutes: duration,
      candidates,
    };
  });
}
