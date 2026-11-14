import { describe, expect, it, vi } from 'vitest';
import { RedisOfferCache } from '../src/cache/redis-cache.js';

describe('RedisOfferCache (Offline / Fallback)', () => {
  const offlineUrl = 'redis://127.0.0.1:63799';

  it('returns false on ping when Redis is unavailable', async () => {
    const cache = new RedisOfferCache(offlineUrl);
    const healthy = await cache.ping();
    expect(healthy).toBe(false);
    await cache.close();
  });

  it('returns null on get when Redis is unavailable', async () => {
    const cache = new RedisOfferCache(offlineUrl);
    const value = await cache.get('test-key');
    expect(value).toBeNull();
    await cache.close();
  });

  it('does not throw on set when Redis is unavailable', async () => {
    const cache = new RedisOfferCache(offlineUrl);
    await expect(cache.set('test-key', 'test-value', 60)).resolves.toBeUndefined();
    await cache.close();
  });

  it('handles close cleanly when disconnected', async () => {
    const cache = new RedisOfferCache(offlineUrl);
    await expect(cache.close()).resolves.toBeUndefined();
  });

  it('shares concurrent connection attempts and closes without hanging', async () => {
    const cache = new RedisOfferCache(offlineUrl);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const ping = cache.ping();
    const get = cache.get('concurrent-test-key');
    const set = cache.set('concurrent-test-key', 'value', 60);
    const close = cache.close();

    await expect(Promise.all([ping, get, set, close])).resolves.toEqual([
      false,
      null,
      undefined,
      undefined,
    ]);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('Redis unavailable; continuing without cache');
    expect(error).toHaveBeenCalledWith('Redis client error');

    warning.mockRestore();
    error.mockRestore();
  });
});
