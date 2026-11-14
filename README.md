# Hotel Offer Orchestrator

Node.js/TypeScript backend that aggregates hotel offers from multiple providers, deduplicates offers by normalized hotel name, and caches aggregate responses in Redis.

## Quick start

Requirements: Node.js 22 LTS or 24+, npm, and Docker Desktop (or another Docker
engine) if using local Redis.

```bash
docker compose up -d redis
npm ci
npm run dev
```

The API listens on `http://localhost:3000` by default.
`.env.example` documents supported variables, but the application does not load
`.env` files automatically. Set variables in the process environment as shown below.

PowerShell development:

```powershell
$env:PORT = '3100'
$env:CACHE_TTL_SECONDS = '60'
npm run dev
```

PowerShell production:

```powershell
$env:PORT = '3100'
$env:CACHE_TTL_SECONDS = '60'
npm run build
npm run start
```

Unix-like shells:

```bash
PORT=3100 CACHE_TTL_SECONDS=60 npm run dev
PORT=3100 CACHE_TTL_SECONDS=60 npm run build
PORT=3100 CACHE_TTL_SECONDS=60 npm run start
```

The documented route, request fields, and response below are fallback
implementation choices until checked against the employer's full assignment.

## API

```bash
curl "http://localhost:3000/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2"
```

Successful response contains `data` with one item per normalized hotel name and `meta.source` equal to `live` or `cache`.

With the included mock providers, this request currently produces three offers
(the duplicate Sea Breeze entry is removed; the direct mock's first offer wins):

```json
{
  "data": [
    {
      "hotelName": "Sea Breeze Resort",
      "price": 7200,
      "currency": "INR",
      "source": "direct-mock",
      "available": true
    },
    {
      "hotelName": "Palm Grove Hotel",
      "price": 5800,
      "currency": "INR",
      "source": "direct-mock",
      "available": true
    },
    {
      "hotelName": "Harbor View Suites",
      "price": 8500,
      "currency": "INR",
      "source": "marketplace-mock",
      "available": true
    }
  ],
  "meta": {
    "source": "live",
    "providerCount": 2,
    "offerCount": 3,
    "cacheKey": "hotel-offers:v1:<sha256>"
  }
}
```

```bash
curl http://localhost:3000/health
```

## Scripts

```text
npm run dev          Start development server
npm run build        Compile TypeScript
npm run start        Start compiled server (`dist/src/server.js`)
npm run typecheck    Type-check without emit
npm run lint         Run ESLint
npm run format       Format source and docs
npm run format:check Check formatting
npm test -- --run    Run tests once
```

## Architecture

The HTTP route validates search criteria and delegates to `OfferOrchestrator`. The orchestrator creates a canonical versioned cache key, checks Redis, invokes provider adapters concurrently on a miss, isolates provider failures, normalizes and deduplicates offers, and writes the aggregate result with a configurable TTL. Provider-specific shapes stay inside adapters.

The configured providers are deterministic local mocks, not live hotel integrations.
They require no provider account or API key. Both return fixed hotel names, INR
currency, and `available: true`; their prices are fixed base values plus INR 100
times the remainder after dividing the sum of the city's character code points
by 11. Check-in, check-out, and guest count affect validation and cache-key
isolation, but do not change the mock offers. The two providers return
differently formatted versions of Sea Breeze Resort; name
normalization removes the duplicate and keeps the first provider's offer.
Whether mock providers, these fields, or this duplicate-selection rule meet the
employer's requirements is unverified.

Each provider has a configured deadline. On timeout, the orchestrator aborts its
signal and stops waiting; a provider that ignores cancellation may continue its
underlying work. Failed or timed-out providers are isolated. Partial aggregates are
returned live but not cached, so a recovered provider is queried on the next request.

Malformed cache values and Redis read failures are treated as cache misses. Successful
live results are returned if cache writes fail; cache failures are logged without
including cache contents or connection strings. Redis health is reported as degraded
while Redis is unavailable.

## Assumptions

The full employer assignment contract is not present in this workspace. The fallback
API and behavioral assumptions are documented in `docs/01-assignment-analysis.md`
and `docs/assignment-contract.md`. Compare them with the official assignment before
submission, especially endpoint shape, provider schema, duplicate-selection rule,
real-versus-mock provider expectations, and evaluator commands.

## Tests

Unit tests cover criteria normalization, cache key stability, deduplication, cache
hits, partial provider recovery, provider failure/timeout cases, malformed cache
fallback, and Redis-offline behavior. Fastify injection tests cover HTTP behavior
without binding a real port. Run `npm run test:coverage` for coverage. Core tests do
not require Docker; the Redis smoke and online cache tests require a running Redis.

Start local Redis with `docker compose up -d redis` after confirming the Docker
engine is running. Stop only this project's service with `docker compose stop redis`.
Do not flush shared Redis data.

## Repository docs

See `docs/` for requirements, architecture, stack, implementation plan, testing strategy, and submission checklist. See `prompts/master-ai-engineering-prompt.md` for a reusable prompt that instructs an AI coding assistant to inspect and complete the assignment without guessing.
