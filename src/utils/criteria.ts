import { createHash } from 'node:crypto';
import type { SearchCriteria } from '../types/domain.js';

export function normalizeCriteria(criteria: SearchCriteria): SearchCriteria {
  return {
    city: criteria.city.trim().replace(/\s+/gu, ' '),
    checkIn: criteria.checkIn,
    checkOut: criteria.checkOut,
    guests: criteria.guests,
  };
}

export function createCacheKey(criteria: SearchCriteria): string {
  const canonical = JSON.stringify(normalizeCriteria(criteria));
  const digest = createHash('sha256').update(canonical).digest('hex');
  return `hotel-offers:v1:${digest}`;
}

export function normalizeHotelName(name: string): string {
  return name.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

export function deduplicateOffers<T extends HotelOfferLike>(offers: T[]): T[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const key = normalizeHotelName(offer.hotelName);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type HotelOfferLike = { hotelName: string };
