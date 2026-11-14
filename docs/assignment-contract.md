# Fallback API Contract (Not Officially Confirmed)

The employer's full assignment document/starter contract is not present in this
workspace. The following contract describes the current implementation and is a
fallback, not a confirmed employer requirement. Check the original assignment before
submission.

## Endpoint

```
GET /api/v1/hotels/offers
```

### Query Parameters

| Parameter  | Type    | Constraints                               |
| ---------- | ------- | ----------------------------------------- |
| `city`     | string  | 1-100 chars, trimmed                      |
| `checkIn`  | string  | Valid Gregorian date in YYYY-MM-DD format |
| `checkOut` | string  | Valid Gregorian date after checkIn        |
| `guests`   | integer | 1-20                                      |

### Success Response (200)

```json
{
  "data": [
    {
      "hotelName": "Sea Breeze Resort",
      "price": 7200,
      "currency": "INR",
      "source": "direct-mock",
      "available": true
    }
  ],
  "meta": {
    "source": "live",
    "providerCount": 2,
    "offerCount": 3,
    "cacheKey": "hotel-offers:v1:abc123..."
  }
}
```

### Error Responses

| Status | Code               | Condition                           |
| ------ | ------------------ | ----------------------------------- |
| 400    | `VALIDATION_ERROR` | Invalid or missing query parameters |
| 502    | `PROVIDER_ERROR`   | All providers failed                |
| 500    | `INTERNAL_ERROR`   | Unexpected internal error           |

## Health Endpoint

```
GET /health
```

| Status | Body                                          |
| ------ | --------------------------------------------- |
| 200    | `{"status":"ok","redis":"ok"}`                |
| 503    | `{"status":"degraded","redis":"unavailable"}` |

## Provider Interface

```typescript
interface HotelOfferProvider {
  readonly name: string;
  getOffers(criteria: SearchCriteria, signal?: AbortSignal): Promise<HotelOffer[]>;
}
```

## Cache Interface

```typescript
interface OfferCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
```

## Deduplication Rule

Normalize hotel name: trim, collapse whitespace, case-fold to lowercase (en-US). Keep first occurrence. No price selection — first provider wins.

## Cache Key

`hotel-offers:v1:{sha256(canonical JSON of normalized criteria)}`

## Scripts

| Script        | Command                         |
| ------------- | ------------------------------- |
| dev           | `tsx watch src/server.ts`       |
| build         | `tsc -p tsconfig.json`          |
| start         | `node dist/src/server.js`       |
| typecheck     | `tsc -p tsconfig.json --noEmit` |
| lint          | `eslint .`                      |
| format        | `prettier --write .`            |
| format:check  | `prettier --check .`            |
| test          | `vitest`                        |
| test:coverage | `vitest --coverage`             |
