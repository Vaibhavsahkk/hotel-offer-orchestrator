import { createClient, type RedisClientType } from 'redis';
import type { OfferCache } from '../types/domain.js';

export class RedisOfferCache implements OfferCache {
  private readonly client: RedisClientType;
  private unavailableUntil = 0;
  private connectionAttempt: Promise<boolean> | undefined;
  private closeAttempt: Promise<void> | undefined;
  private closing = false;

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: false,
      },
    });
    this.client.on('error', () => {
      console.error('Redis client error');
    });
  }

  connect(timeoutMs = 1_500): Promise<boolean> {
    if (this.closing) return Promise.resolve(false);
    if (this.client.isReady) return Promise.resolve(true);
    if (Date.now() < this.unavailableUntil) return Promise.resolve(false);
    if (this.connectionAttempt !== undefined) return this.connectionAttempt;

    const attempt = this.connectWithTimeout(timeoutMs).finally(() => {
      if (this.connectionAttempt === attempt) this.connectionAttempt = undefined;
    });
    this.connectionAttempt = attempt;
    return attempt;
  }

  private async connectWithTimeout(timeoutMs: number): Promise<boolean> {
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        this.client.connect(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Redis connection timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });
      return this.client.isReady;
    } catch {
      this.unavailableUntil = Date.now() + 5_000;
      console.warn('Redis unavailable; continuing without cache');
      if (this.client.isOpen) await this.client.disconnect().catch(() => undefined);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!(await this.connect())) return null;
      return await this.client.get(key);
    } catch {
      console.warn('Redis read failed; continuing without cache');
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      if (!(await this.connect())) return;
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch {
      console.warn('Redis write failed; continuing without cache');
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.connect()) && (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  close(): Promise<void> {
    if (this.closeAttempt !== undefined) return this.closeAttempt;

    this.closing = true;
    this.closeAttempt = (async () => {
      await this.connectionAttempt?.catch(() => false);
      if (this.client.isOpen) await this.client.quit();
    })();
    return this.closeAttempt;
  }
}
