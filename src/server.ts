import { buildApp } from './app.js';
import { loadConfig } from './utils/config.js';
import { RedisOfferCache } from './cache/redis-cache.js';

const config = loadConfig();
const cache = new RedisOfferCache(config.REDIS_URL);
const app = buildApp(config, { cache });

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
