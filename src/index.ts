import Fastify from 'fastify';
import { discoverRoutes } from './routes/discover';
import { bookingRoutes } from './routes/bookings';
import { metricsRoutes } from './routes/metrics';
import { logger } from './middleware/logger';

const app = Fastify({ logger });

app.get('/', async () => {
  return { message: 'WokiBrain API' };
});

app.register(discoverRoutes);
app.register(bookingRoutes);
app.register(metricsRoutes);

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
