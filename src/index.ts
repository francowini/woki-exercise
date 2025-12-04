import Fastify from 'fastify';
import { discoverRoutes } from './routes/discover';
import { bookingRoutes } from './routes/bookings';
import { metricsRoutes } from './routes/metrics';
import { logger } from './middleware/logger';
import { Database } from './store/db';
import { MetricsStore } from './store/metrics';
import { LockManager } from './store/locks';
import { IdempotencyStore } from './store/idempotency';
import { createBookingService } from './services/bookings';
import { createAvailabilityService } from './services/availability';

const app = Fastify({ logger });

const db = new Database();
const metrics = new MetricsStore();
const lockManager = new LockManager(metrics);
const idempotencyStore = new IdempotencyStore();

const availabilityService = createAvailabilityService(db);
const bookingService = createBookingService({ db, lockManager, idempotencyStore, metrics });

app.get('/', async () => {
  return { message: 'WokiBrain API' };
});

app.register(discoverRoutes, { db, availabilityService });
app.register(bookingRoutes, { db, bookingService });
app.register(metricsRoutes, { metrics });

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
