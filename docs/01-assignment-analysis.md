# Hotel Offer Orchestrator — Assignment Analysis

## Source and access status

The full assignment document and starter-repository contract were not found in this
workspace. The only available source is the invitation preview, which states:

> Node.js / TypeScript + Redis. Aggregate hotel offers from providers, deduplicate by hotel name, and cache results in Redis. Submit through GitHub.

This short preview does not establish exact endpoint, request/response, provider URL,
deduplication policy, or evaluator requirements. The API and provider choices below
are fallback implementation decisions, not confirmed employer requirements.

## Functional goal

Build a small HTTP backend that accepts a hotel-search request, queries multiple offer providers, merges provider responses, keeps one canonical result per hotel name, and caches the final result in Redis. A repeated request with the same normalized search criteria should be served from Redis without calling providers.

## Requirements confirmed by the invitation preview

The invitation preview names Node.js/TypeScript and Redis, and says to aggregate
hotel offers, deduplicate by hotel name, cache results, and submit via GitHub. It
does not provide a complete behavioral or evaluation contract.

## Fallback contract used by this solution

`GET /api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2`

Response:

```json
{
  "data": [
    {
      "hotelName": "Sea Breeze Resort",
      "price": 7200,
      "currency": "INR",
      "source": "provider-a",
      "available": true
    }
  ],
  "meta": {
    "source": "live",
    "providerCount": 2,
    "offerCount": 1,
    "cacheKey": "hotel-offers:v1:..."
  }
}
```

If the hidden starter repo specifies another contract, preserve its contract over this fallback contract and update adapters/tests accordingly.

## Behavioral decisions

Provider calls run in parallel so one slow provider does not unnecessarily delay other providers. A provider failure is isolated and does not fail the whole request when at least one provider succeeds. If every provider fails, the service returns a dependency failure. Empty provider results remain valid and return an empty list. Deduplication is case-insensitive and whitespace-normalized; first provider order wins for stable output. Cache keys include every input that can change the response. Cache TTL is configurable through `CACHE_TTL_SECONDS`.

## Implementation choices (not confirmed employer requirements)

The implementation uses strict TypeScript, runtime input validation, bounded
provider timeouts, structured logging, graceful-shutdown hooks, health checks,
deterministic tests, and Docker-based local Redis support. These are engineering
choices, not requirements confirmed by the short invitation preview.

## Ambiguities to confirm against starter repo

Exact endpoint path and HTTP method; exact query/body schema; provider response shapes; price sort or selection rule when duplicate hotels differ; whether one provider failure should be visible in response metadata; required framework; required Redis client; exact TTL; and evaluator command names.

## Submission risk

Do not claim exact compliance with inaccessible hidden instructions. Before GitHub submission, compare this contract with starter README, package scripts, tests, and evaluator instructions. Preserve any required filenames and commands.
