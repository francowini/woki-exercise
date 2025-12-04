import { FastifyInstance } from 'fastify';
import { MetricsStore } from '../store/metrics';

interface MetricsRoutesOpts {
  metrics: MetricsStore;
}

export async function metricsRoutes(app: FastifyInstance, opts: MetricsRoutesOpts) {
  const { metrics } = opts;

  app.get('/metrics', async () => {
    return metrics.getSnapshot();
  });
}
