import { FastifyInstance } from 'fastify';
import { bookingBody, dayQuery, bookingIdParam } from '../schemas';
import { Database } from '../store/db';
import { BookingService } from '../services/bookings';
import { BookingId } from '../domain/types';

interface BookingRoutesOpts {
  db: Database;
  bookingService: BookingService;
}

export async function bookingRoutes(app: FastifyInstance, opts: BookingRoutesOpts) {
  const { db, bookingService } = opts;

  app.post('/woki/bookings', async (req, reply) => {
    const parsed = bookingBody.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') || 'unknown';
      return reply.status(400).send({
        error: 'invalid_input',
        detail: `${field}: ${issue?.message || 'Invalid value'}`,
      });
    }

    try {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const booking = await bookingService.createBooking(parsed.data, idempotencyKey);

      return reply.status(201).send({
        id: booking.id,
        restaurantId: booking.restaurantId,
        sectorId: booking.sectorId,
        tableIds: booking.tableIds,
        partySize: booking.partySize,
        start: booking.start,
        end: booking.end,
        durationMinutes: booking.durationMinutes,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        const code = (error as any).code || 'internal_error';
        const statusCode = (error as any).statusCode || 500;
        return reply.status(statusCode).send({
          error: code,
          detail: error.message,
        });
      }

      app.log.error(error);
      return reply.status(500).send({
        error: 'internal_error',
        detail: 'An unexpected error occurred',
      });
    }
  });

  app.get('/woki/bookings/day', async (req, reply) => {
    const parsed = dayQuery.safeParse(req.query);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') || 'unknown';
      return reply.status(400).send({
        error: 'invalid_input',
        detail: `${field}: ${issue?.message || 'Invalid value'}`,
      });
    }

    const { restaurantId, sectorId, date } = parsed.data;

    const restaurant = db.getRestaurant(restaurantId);
    if (!restaurant) {
      return reply.status(404).send({
        error: 'not_found',
        detail: 'Restaurant not found',
      });
    }

    const sector = db.getSector(sectorId);
    if (!sector || sector.restaurantId !== restaurantId) {
      return reply.status(404).send({
        error: 'not_found',
        detail: 'Sector not found',
      });
    }

    const bookings = db.getBookingsBySector(sectorId)
      .filter(b => b.status === 'CONFIRMED' && b.start.startsWith(date));

    const items = bookings.map(b => ({
      id: b.id,
      tableIds: b.tableIds,
      partySize: b.partySize,
      start: b.start,
      end: b.end,
      status: b.status,
    }));

    return reply.status(200).send({ date, items });
  });

  app.delete('/woki/bookings/:id', async (req, reply) => {
    const parsed = bookingIdParam.safeParse(req.params);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') || 'unknown';
      return reply.status(400).send({
        error: 'invalid_input',
        detail: `${field}: ${issue?.message || 'Invalid value'}`,
      });
    }

    try {
      await bookingService.deleteBooking(parsed.data.id as BookingId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const code = (error as any).code || 'internal_error';
        const statusCode = (error as any).statusCode || 500;
        return reply.status(statusCode).send({
          error: code,
          detail: error.message,
        });
      }

      app.log.error(error);
      return reply.status(500).send({
        error: 'internal_error',
        detail: 'An unexpected error occurred',
      });
    }
  });
}
