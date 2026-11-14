import { describe, expect, it, vi } from 'vitest';
import { MemoryOfferCache } from '../src/cache/memory-cache.js';
import { OfferOrchestrator, AllProvidersFailedError } from '../src/services/offer-orchestrator.js';
import type { HotelOfferProvider } from '../src/types/domain.js';

const criteria = { city: ' Goa ', checkIn: '2026-12-20', checkOut: '2026-12-22', guests: 2 };

function provider(
  name: string,
  offers: Awaited<ReturnType<HotelOfferProvider['getOffers']>>,
): HotelOfferProvider {
  return { name, getOffers: async () => offers };
}

describe('OfferOrchestrator', () => {
  it('deduplicates hotel names case-insensitively and preserves first offer', async () => {
    const orchestrator = new OfferOrchestrator({
      providers: [
        provider('a', [
          {
            hotelName: 'Sea Breeze Resort',
            price: 7000,
            currency: 'INR',
            source: 'a',
            available: true,
          },
        ]),
        provider('b', [
          {
            hotelName: ' sea   breeze resort ',
            price: 7500,
            currency: 'INR',
            source: 'b',
            available: true,
          },
          { hotelName: 'Palm Grove', price: 5000, currency: 'INR', source: 'b', available: true },
        ]),
      ],
      cache: new MemoryOfferCache(),
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    const result = await orchestrator.getOffers(criteria);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.source).toBe('a');
    expect(result.meta.source).toBe('live');
  });

  it('serves cache hit without calling providers', async () => {
    const cache = new MemoryOfferCache();
    let calls = 0;
    const orchestrator = new OfferOrchestrator({
      providers: [
        {
          name: 'counted',
          getOffers: async () => {
            calls += 1;
            return [];
          },
        },
      ],
      cache,
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    await orchestrator.getOffers(criteria);
    const result = await orchestrator.getOffers(criteria);
    expect(calls).toBe(1);
    expect(result.meta.source).toBe('cache');
  });

  it('returns successful provider offers when another provider fails', async () => {
    const orchestrator = new OfferOrchestrator({
      providers: [
        {
          name: 'failed',
          getOffers: async () => {
            throw new Error('upstream');
          },
        },
        provider('healthy', [
          {
            hotelName: 'Only Hotel',
            price: 100,
            currency: 'INR',
            source: 'healthy',
            available: true,
          },
        ]),
      ],
      cache: new MemoryOfferCache(),
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    await expect(orchestrator.getOffers(criteria)).resolves.toMatchObject({
      data: [{ hotelName: 'Only Hotel' }],
    });
  });

  it('does not cache partial results and includes a recovered provider next time', async () => {
    const cache = new MemoryOfferCache();
    let recovered = false;
    let recoveredProviderCalls = 0;
    const orchestrator = new OfferOrchestrator({
      providers: [
        provider('stable', [
          {
            hotelName: 'Stable Hotel',
            price: 100,
            currency: 'INR',
            source: 'stable',
            available: true,
          },
        ]),
        {
          name: 'recovering',
          getOffers: async () => {
            recoveredProviderCalls += 1;
            if (!recovered) throw new Error('temporarily unavailable');
            return [
              {
                hotelName: 'Recovered Hotel',
                price: 200,
                currency: 'INR',
                source: 'recovering',
                available: true,
              },
            ];
          },
        },
      ],
      cache,
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    const partial = await orchestrator.getOffers(criteria);
    expect(partial.data.map((offer) => offer.hotelName)).toEqual(['Stable Hotel']);
    expect(partial.meta.source).toBe('live');

    recovered = true;
    const complete = await orchestrator.getOffers(criteria);
    expect(complete.data.map((offer) => offer.hotelName)).toEqual([
      'Stable Hotel',
      'Recovered Hotel',
    ]);
    expect(complete.meta.source).toBe('live');
    expect(recoveredProviderCalls).toBe(2);
    expect((await cache.get(complete.meta.cacheKey)) !== null).toBe(true);
  });

  it('fails when all providers fail', async () => {
    const orchestrator = new OfferOrchestrator({
      providers: [
        {
          name: 'failed',
          getOffers: async () => {
            throw new Error('upstream');
          },
        },
      ],
      cache: new MemoryOfferCache(),
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    await expect(orchestrator.getOffers(criteria)).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it('returns empty data when all providers return empty results', async () => {
    const orchestrator = new OfferOrchestrator({
      providers: [provider('empty-a', []), provider('empty-b', [])],
      cache: new MemoryOfferCache(),
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    const result = await orchestrator.getOffers(criteria);
    expect(result.data).toHaveLength(0);
    expect(result.meta.source).toBe('live');
  });

  it('continues serving live requests when cache write fails', async () => {
    const brokenCache = new MemoryOfferCache();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    brokenCache.set = async () => {
      throw new Error('cache write failed');
    };

    const orchestrator = new OfferOrchestrator({
      providers: [
        provider('a', [
          { hotelName: 'Test Hotel', price: 100, currency: 'INR', source: 'a', available: true },
        ]),
      ],
      cache: brokenCache,
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    const result = await orchestrator.getOffers(criteria);
    expect(result.data).toHaveLength(1);
    expect(result.meta.source).toBe('live');
    expect(warning).toHaveBeenCalledWith('Cache write failed; returning live provider results');
    warning.mockRestore();
  });

  it.each(['{malformed', JSON.stringify([{ hotelName: 'Hotel without required fields' }])])(
    'treats invalid cached content as a miss and refreshes it',
    async (cachedValue) => {
      const cache = new MemoryOfferCache();
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      let providerCalls = 0;
      let writes = 0;
      cache.get = async () => cachedValue;
      cache.set = async () => {
        writes += 1;
      };
      const orchestrator = new OfferOrchestrator({
        providers: [
          {
            name: 'live',
            getOffers: async () => {
              providerCalls += 1;
              return [
                {
                  hotelName: 'Live Hotel',
                  price: 100,
                  currency: 'INR',
                  source: 'live',
                  available: true,
                },
              ];
            },
          },
        ],
        cache,
        cacheTtlSeconds: 60,
        providerTimeoutMs: 100,
      });

      const result = await orchestrator.getOffers(criteria);
      expect(result.meta.source).toBe('live');
      expect(result.data[0]?.hotelName).toBe('Live Hotel');
      expect(providerCalls).toBe(1);
      expect(writes).toBe(1);
      expect(warning).toHaveBeenCalledWith(
        'Ignoring invalid cached offers; fetching live provider results',
      );
      warning.mockRestore();
    },
  );

  it('continues with live results when cache reads reject', async () => {
    const cache = new MemoryOfferCache();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let writes = 0;
    cache.get = async () => {
      throw new Error('cache unavailable');
    };
    cache.set = async () => {
      writes += 1;
    };
    const orchestrator = new OfferOrchestrator({
      providers: [
        provider('live', [
          { hotelName: 'Live Hotel', price: 100, currency: 'INR', source: 'live', available: true },
        ]),
      ],
      cache,
      cacheTtlSeconds: 60,
      providerTimeoutMs: 100,
    });

    const result = await orchestrator.getOffers(criteria);
    expect(result.meta.source).toBe('live');
    expect(result.data).toHaveLength(1);
    expect(writes).toBe(1);
    expect(warning).toHaveBeenCalledWith('Cache read failed; fetching live provider results');
    warning.mockRestore();
  });

  it('aborts and rejects a provider that never settles', async () => {
    vi.useFakeTimers();
    try {
      let wasAborted = false;
      const orchestrator = new OfferOrchestrator({
        providers: [
          {
            name: 'uncooperative',
            getOffers: async (_criteria, signal) => {
              signal?.addEventListener('abort', () => {
                wasAborted = true;
              });
              return new Promise(() => {});
            },
          },
        ],
        cache: new MemoryOfferCache(),
        cacheTtlSeconds: 60,
        providerTimeoutMs: 50,
      });

      const request = expect(orchestrator.getOffers(criteria)).rejects.toBeInstanceOf(
        AllProvidersFailedError,
      );
      await vi.advanceTimersByTimeAsync(50);
      await request;
      expect(wasAborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns a successful provider result when another provider times out', async () => {
    vi.useFakeTimers();
    try {
      const orchestrator = new OfferOrchestrator({
        providers: [
          {
            name: 'uncooperative',
            getOffers: async () => new Promise(() => {}),
          },
          provider('fast', [
            {
              hotelName: 'Fast Hotel',
              price: 100,
              currency: 'INR',
              source: 'fast',
              available: true,
            },
          ]),
        ],
        cache: new MemoryOfferCache(),
        cacheTtlSeconds: 60,
        providerTimeoutMs: 50,
      });

      const request = expect(orchestrator.getOffers(criteria)).resolves.toMatchObject({
        data: [{ hotelName: 'Fast Hotel' }],
        meta: { source: 'live' },
      });
      await vi.advanceTimersByTimeAsync(50);
      await request;
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails when all providers time out', async () => {
    vi.useFakeTimers();
    try {
      const orchestrator = new OfferOrchestrator({
        providers: [
          { name: 'first', getOffers: async () => new Promise(() => {}) },
          { name: 'second', getOffers: async () => new Promise(() => {}) },
        ],
        cache: new MemoryOfferCache(),
        cacheTtlSeconds: 60,
        providerTimeoutMs: 50,
      });

      const request = expect(orchestrator.getOffers(criteria)).rejects.toBeInstanceOf(
        AllProvidersFailedError,
      );
      await vi.advanceTimersByTimeAsync(50);
      await request;
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles a provider rejecting after its timeout without an unhandled rejection', async () => {
    vi.useFakeTimers();
    try {
      let rejectProvider: ((reason: Error) => void) | undefined;
      const orchestrator = new OfferOrchestrator({
        providers: [
          {
            name: 'late-reject',
            getOffers: async () =>
              new Promise((_resolve, reject) => {
                rejectProvider = reject;
              }),
          },
        ],
        cache: new MemoryOfferCache(),
        cacheTtlSeconds: 60,
        providerTimeoutMs: 50,
      });

      const request = expect(orchestrator.getOffers(criteria)).rejects.toBeInstanceOf(
        AllProvidersFailedError,
      );
      await vi.advanceTimersByTimeAsync(50);
      await request;
      if (rejectProvider === undefined) throw new Error('Provider was not invoked');
      rejectProvider(new Error('late rejection'));
      await vi.runAllTicks();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timeout when a provider succeeds within the deadline', async () => {
    vi.useFakeTimers();
    try {
      const orchestrator = new OfferOrchestrator({
        providers: [
          provider('fast', [
            {
              hotelName: 'Fast Hotel',
              price: 100,
              currency: 'INR',
              source: 'fast',
              available: true,
            },
          ]),
        ],
        cache: new MemoryOfferCache(),
        cacheTtlSeconds: 60,
        providerTimeoutMs: 50,
      });

      const result = await orchestrator.getOffers(criteria);
      expect(result.data).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
