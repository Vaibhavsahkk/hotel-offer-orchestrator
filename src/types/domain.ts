export interface SearchCriteria {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export interface HotelOffer {
  hotelName: string;
  price: number;
  currency: string;
  source: string;
  available: boolean;
}

export interface ProviderResult {
  provider: string;
  offers: HotelOffer[];
}

export interface AggregatedOffers {
  data: HotelOffer[];
  meta: {
    source: 'live' | 'cache';
    providerCount: number;
    offerCount: number;
    cacheKey: string;
  };
}

export interface HotelOfferProvider {
  readonly name: string;
  getOffers(criteria: SearchCriteria, signal?: AbortSignal): Promise<HotelOffer[]>;
}

export interface OfferCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
