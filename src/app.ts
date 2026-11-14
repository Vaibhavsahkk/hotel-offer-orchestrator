import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './utils/config.js';
import { RedisOfferCache } from './cache/redis-cache.js';
import { DirectMockProvider, MarketplaceMockProvider } from './providers/mock-providers.js';
import { AllProvidersFailedError, OfferOrchestrator } from './services/offer-orchestrator.js';
import { searchQuerySchema } from './routes/schemas.js';
import type { OfferCache, HotelOfferProvider } from './types/domain.js';

export interface AppDependencies {
  cache?: OfferCache;
  providers?: HotelOfferProvider[];
}

export function buildApp(config: Config, dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' });
  const cache = dependencies.cache ?? new RedisOfferCache(config.REDIS_URL);
  const providers = dependencies.providers ?? [
    new DirectMockProvider(),
    new MarketplaceMockProvider(),
  ];
  const orchestrator = new OfferOrchestrator({
    providers,
    cache,
    cacheTtlSeconds: config.CACHE_TTL_SECONDS,
    providerTimeoutMs: config.PROVIDER_TIMEOUT_MS,
  });

  app.get('/health', async (_request, reply) => {
    const redisHealthy = await cache.ping();
    return reply.code(redisHealthy ? 200 : 503).send({
      status: redisHealthy ? 'ok' : 'degraded',
      redis: redisHealthy ? 'ok' : 'unavailable',
    });
  });

  app.get('/api/v1/hotels/offers', async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid hotel search parameters',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      return reply.send(await orchestrator.getOffers(parsed.data));
    } catch (error) {
      if (error instanceof AllProvidersFailedError) {
        return reply.code(502).send({
          error: { code: 'PROVIDER_ERROR', message: error.message },
        });
      }
      request.log.error(error);
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected internal error' },
      });
    }
  });

  app.addHook('onClose', async () => {
    await cache.close();
  });

  return app;
}
