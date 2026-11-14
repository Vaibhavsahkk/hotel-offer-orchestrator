import type {
  AggregatedOffers,
  HotelOffer,
  HotelOfferProvider,
  OfferCache,
  SearchCriteria,
} from '../types/domain.js';
import { createCacheKey, deduplicateOffers, normalizeCriteria } from '../utils/criteria.js';

export class AllProvidersFailedError extends Error {
  constructor() {
    super('All hotel offer providers failed');
    this.name = 'AllProvidersFailedError';
  }
}

function isHotelOffer(value: unknown): value is HotelOffer {
  if (typeof value !== 'object' || value === null) return false;

  const offer = value as Record<string, unknown>;
  return (
    typeof offer.hotelName === 'string' &&
    offer.hotelName.trim().length > 0 &&
    typeof offer.price === 'number' &&
    Number.isFinite(offer.price) &&
    typeof offer.currency === 'string' &&
    offer.currency.trim().length > 0 &&
    typeof offer.source === 'string' &&
    offer.source.trim().length > 0 &&
    typeof offer.available === 'boolean'
  );
}

function parseCachedOffers(value: string): HotelOffer[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(isHotelOffer) ? parsed : null;
  } catch {
    return null;
  }
}

export interface OrchestratorOptions {
  providers: HotelOfferProvider[];
  cache: OfferCache;
  cacheTtlSeconds: number;
  providerTimeoutMs: number;
}

export class OfferOrchestrator {
  constructor(private readonly options: OrchestratorOptions) {}

  async getOffers(criteria: SearchCriteria): Promise<AggregatedOffers> {
    const normalizedCriteria = normalizeCriteria(criteria);
    const cacheKey = createCacheKey(normalizedCriteria);
    let cached: string | null = null;

    try {
      cached = await this.options.cache.get(cacheKey);
    } catch {
      console.warn('Cache read failed; fetching live provider results');
    }

    if (cached !== null) {
      const data = parseCachedOffers(cached);
      if (data !== null) {
        return {
          data,
          meta: {
            source: 'cache',
            providerCount: this.options.providers.length,
            offerCount: data.length,
            cacheKey,
          },
        };
      }

      console.warn('Ignoring invalid cached offers; fetching live provider results');
    }

    const results = await Promise.allSettled(
      this.options.providers.map((provider) => this.withTimeout(provider, normalizedCriteria)),
    );

    const anyFulfilled = results.some((result) => result.status === 'fulfilled');
    if (!anyFulfilled && results.length > 0) {
      throw new AllProvidersFailedError();
    }

    const successfulOffers = results
      .filter(
        (result): result is PromiseFulfilledResult<HotelOffer[]> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value);

    const data = deduplicateOffers(successfulOffers);
    const allProvidersSucceeded = results.every((result) => result.status === 'fulfilled');
    if (allProvidersSucceeded) {
      try {
        await this.options.cache.set(cacheKey, JSON.stringify(data), this.options.cacheTtlSeconds);
      } catch {
        console.warn('Cache write failed; returning live provider results');
      }
    }

    return {
      data,
      meta: {
        source: 'live',
        providerCount: this.options.providers.length,
        offerCount: data.length,
        cacheKey,
      },
    };
  }

  private async withTimeout(
    provider: HotelOfferProvider,
    criteria: SearchCriteria,
  ): Promise<HotelOffer[]> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Provider ${provider.name} timed out`));
      }, this.options.providerTimeoutMs);
    });

    try {
      // The timeout stops waiting and signals cancellation; an uncooperative provider may continue running.
      return await Promise.race([provider.getOffers(criteria, controller.signal), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
