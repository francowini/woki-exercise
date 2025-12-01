import { FastifyServerOptions } from 'fastify';

// pretty logs in dev, json in prod
export const logger: FastifyServerOptions['logger'] = {
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
};
