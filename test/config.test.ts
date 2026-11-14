import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/utils/config.js';

describe('loadConfig', () => {
  it('loads valid defaults when env is empty', () => {
    const config = loadConfig({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.PORT).toBe(3000);
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.CACHE_TTL_SECONDS).toBe(300);
    expect(config.PROVIDER_TIMEOUT_MS).toBe(2500);
  });

  it('parses and coerces custom env overrides', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '8080',
      REDIS_URL: 'redis://custom-host:6380',
      CACHE_TTL_SECONDS: '600',
      PROVIDER_TIMEOUT_MS: '5000',
    });
    expect(config.NODE_ENV).toBe('production');
    expect(config.PORT).toBe(8080);
    expect(config.CACHE_TTL_SECONDS).toBe(600);
  });

  it('throws on invalid configuration values', () => {
    expect(() => loadConfig({ PORT: 'invalid-port' })).toThrow();
    expect(() => loadConfig({ REDIS_URL: 'not-a-url' })).toThrow();
  });
});
