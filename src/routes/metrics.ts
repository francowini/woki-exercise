import { FastifyPluginAsync } from 'fastify';
import { metrics } from '../store/metrics';

export const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/metrics', async () => {
    return metrics.getSnapshot();
  });
};
