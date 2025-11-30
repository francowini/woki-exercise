import { FastifyInstance } from 'fastify';
import { bookingBody } from '../schemas';
import { createBooking } from '../services/bookings';

export async function bookingRoutes(app: FastifyInstance) {
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
      const booking = await createBooking(parsed.data, idempotencyKey);

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
}
