import Fastify from 'fastify';
import { discoverRoutes } from './routes/discover';

const app = Fastify({ logger: true });

app.get('/', async () => {
  return { message: 'WokiBrain API' };
});

app.register(discoverRoutes);

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
