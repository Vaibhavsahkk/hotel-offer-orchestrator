import type { HotelOffer, HotelOfferProvider, SearchCriteria } from '../types/domain.js';

function cityPrice(city: string, base: number): number {
  const seed = [...city].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return base + (seed % 11) * 100;
}

export class DirectMockProvider implements HotelOfferProvider {
  readonly name = 'direct-mock';

  async getOffers(criteria: SearchCriteria): Promise<HotelOffer[]> {
    return [
      {
        hotelName: 'Sea Breeze Resort',
        price: cityPrice(criteria.city, 6_800),
        currency: 'INR',
        source: this.name,
        available: true,
      },
      {
        hotelName: 'Palm Grove Hotel',
        price: cityPrice(criteria.city, 5_400),
        currency: 'INR',
        source: this.name,
        available: true,
      },
    ];
  }
}

export class MarketplaceMockProvider implements HotelOfferProvider {
  readonly name = 'marketplace-mock';

  async getOffers(criteria: SearchCriteria): Promise<HotelOffer[]> {
    return [
      {
        hotelName: ' sea   breeze resort ',
        price: cityPrice(criteria.city, 7_200),
        currency: 'INR',
        source: this.name,
        available: true,
      },
      {
        hotelName: 'Harbor View Suites',
        price: cityPrice(criteria.city, 8_100),
        currency: 'INR',
        source: this.name,
        available: true,
      },
    ];
  }
}
