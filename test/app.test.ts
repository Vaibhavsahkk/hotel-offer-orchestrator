import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryOfferCache } from '../src/cache/memory-cache.js';
import type { Config } from '../src/utils/config.js';

const config: Config = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  REDIS_URL: 'redis://localhost:6379',
  CACHE_TTL_SECONDS: 60,
  PROVIDER_TIMEOUT_MS: 100,
};

describe('HTTP API', () => {
  it('returns offers for valid search', async () => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ meta: { source: 'live' } });
    await app.close();
  });

  it('rejects invalid date interval', async () => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/hotels/offers?city=Goa&checkIn=2026-12-22&checkOut=2026-12-20&guests=2',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it.each([
    ['year zero', '0000-02-29'],
    ['invalid month', '2026-13-01'],
    ['day zero', '2026-01-00'],
    ['February 30', '2026-02-30'],
    ['February 31', '2026-02-31'],
    ['invalid leap day', '2027-02-29'],
  ])('rejects %s', async (_label, checkIn) => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/hotels/offers?city=Goa&checkIn=${checkIn}&checkOut=2028-03-01&guests=2`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('accepts a valid leap day', async () => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/hotels/offers?city=Goa&checkIn=2028-02-29&checkOut=2028-03-01&guests=2',
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('rejects equal check-in and check-out dates', async () => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-20&guests=2',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it.each(['0', '-1', '1.5', '21'])('rejects guests=%s', async (guests) => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=${guests}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('returns health status', async () => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', redis: 'ok' });
    await app.close();
  });

  it('returns degraded health status when cache ping fails', async () => {
    class FailingCache extends MemoryOfferCache {
      override async ping(): Promise<boolean> {
        return false;
      }
    }

    const app = buildApp(config, { cache: new FailingCache() });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'degraded', redis: 'unavailable' });
    await app.close();
  });

  it('serves cached response on repeated HTTP request', async () => {
    const app = buildApp(config, { cache: new MemoryOfferCache() });
    const query = '/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2';

    const first = await app.inject({ method: 'GET', url: query });
    expect(first.statusCode).toBe(200);
    expect(first.json().meta.source).toBe('live');

    const second = await app.inject({ method: 'GET', url: query });
    expect(second.statusCode).toBe(200);
    expect(second.json().meta.source).toBe('cache');
    await app.close();
  });

  it('returns 502 PROVIDER_ERROR when all providers fail', async () => {
    const app = buildApp(config, {
      cache: new MemoryOfferCache(),
      providers: [
        {
          name: 'failing',
          getOffers: async () => {
            throw new Error('provider down');
          },
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2',
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('PROVIDER_ERROR');
    await app.close();
  });
});
