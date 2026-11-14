# Hotel Offer Orchestrator

A Node.js and TypeScript backend that concurrently aggregates hotel offers from two deterministic mock providers, deduplicates by normalized hotel name, and caches complete aggregate responses in Redis. It is a demonstration service, not a connection to real hotel inventory or booking providers.

---

## Features

- **Concurrent Mock-Provider Aggregation**: Queries both configured mock providers in parallel using `Promise.allSettled`, so an individual provider failure does not discard successful offers.
- **First-offer Deduplication**: Normalizes hotel names (trimming, whitespace collapsing, and case-folding). When normalized names match, the first offer in provider order is retained; offers are not compared by price.
- **Read-Through Redis Caching**: Hashes canonical normalized search criteria using SHA-256 to guarantee stable cache keys regardless of query parameter ordering.
- **Cache Integrity & Partial Failure Handling**: Only caches aggregates when all providers succeed, ensuring transient provider outages do not poison the cache with partial inventory.
- **Resilient & Non-Blocking Cache Fallback**: Automatically degrades to live provider queries if Redis is offline or unreachable, with connection throttling to avoid connection storms.
- **Strict Input & Calendar Validation**: Validates query parameters against Gregorian calendar rules (rejecting non-existent dates like `2026-02-31`) and enforces logical check-in/check-out ordering.
- **Graceful Degradation**: Cache access failures fall back to live mock-provider results. Fastify/Pino logging and SIGINT/SIGTERM shutdown handling are configured; OS-signal shutdown behavior should be verified in the target runtime.

---

## Quick Start

### Prerequisites

- **Node.js**: v22 LTS or v24+
- **Docker**: Docker Desktop or an external Redis instance (optional for unit tests)

### 1. Start Local Redis & Install Dependencies

```bash
docker compose up -d redis
npm ci
```

The Compose file starts Redis 7 and publishes it on `localhost:6379`. Redis is not needed by the automated unit/integration suite, which uses in-memory or offline cache doubles. The default application cache connects to `redis://localhost:6379`. If Redis is unavailable, offer searches continue with mock-provider results but cannot use the shared Redis cache.

### 2. Run the Development Server

```bash
npm run dev
```

The server will start listening at `http://localhost:3000`.

### 3. Production Build & Run

```bash
npm run build
npm run start
```

---

## Environment Configuration

Configuration is validated at startup using Zod. Default values allow the application to run out-of-the-box without requiring a `.env` file:

| Variable              | Type   | Default                  | Description                                       |
| --------------------- | ------ | ------------------------ | ------------------------------------------------- |
| `PORT`                | number | `3000`                   | Port for the HTTP server to listen on             |
| `HOST`                | string | `0.0.0.0`                | Host interface to bind                            |
| `NODE_ENV`            | string | `development`            | Environment (`development`, `test`, `production`) |
| `REDIS_URL`           | string | `redis://localhost:6379` | Redis connection URL                              |
| `CACHE_TTL_SECONDS`   | number | `300`                    | Expiration time for cached aggregate responses    |
| `PROVIDER_TIMEOUT_MS` | number | `2500`                   | Maximum time allowed per provider before timeout  |

To override environment variables:

**PowerShell:**

```powershell
$env:PORT = '3100'
$env:CACHE_TTL_SECONDS = '60'
npm run dev
```

**Unix / macOS:**

```bash
PORT=3100 CACHE_TTL_SECONDS=60 npm run dev
```

---

## API Reference

### 1. Search Hotel Offers

Queries the two local mock providers concurrently, deduplicates offers, and caches a complete result when every provider succeeds. These are sample offers, not live inventory, quotes, or booking availability.

```http
GET /api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2
```

#### Query Parameters

| Parameter  | Type    | Required | Description                                                     |
| ---------- | ------- | :------: | --------------------------------------------------------------- |
| `city`     | string  |   Yes    | City name (1–100 characters, trimmed)                           |
| `checkIn`  | string  |   Yes    | Check-in date in `YYYY-MM-DD` format (valid calendar date)      |
| `checkOut` | string  |   Yes    | Check-out date in `YYYY-MM-DD` format (must be after `checkIn`) |
| `guests`   | integer |   Yes    | Number of guests (1–20)                                         |

#### Example Response (200 OK)

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
    "cacheKey": "hotel-offers:v1:46bba265fbfaca3785f6f9258864e06c465a324d424b64ca013b2f91a11d39ab"
  }
}
```

Hotel-name matching trims names, collapses whitespace, and compares case-insensitively. If two offers match, the first is retained; the service does not choose the cheapest price. The direct mock is called before the marketplace mock, so its `"Sea Breeze Resort"` offer wins over the marketplace mock's differently formatted duplicate.

The mock providers return a fixed set of hotel names and availability. They calculate deterministic prices from the city string; the requested dates and guest count do not affect mock inventory or pricing. Subsequent identical successful requests return `"meta": { "source": "cache", ... }` while the Redis entry is valid.

#### Error Responses

- **400 Bad Request (`VALIDATION_ERROR`)**: Invalid dates, missing parameters, or inverted stay duration.
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid hotel search parameters",
      "details": {
        "checkOut": ["must be after checkIn"]
      }
    }
  }
  ```
- **502 Bad Gateway (`PROVIDER_ERROR`)**: Returned when all configured upstream providers fail or time out.
- **500 Internal Server Error (`INTERNAL_ERROR`)**: Unhandled internal exception.

---

### 2. Service Health Check

Inspects application and Redis connectivity.

```http
GET /health
```

- **200 OK** (Redis operational):
  ```json
  {
    "status": "ok",
    "redis": "ok"
  }
  ```
- **503 Service Unavailable** (Redis degraded or offline; application still serves live traffic):
  ```json
  {
    "status": "degraded",
    "redis": "unavailable"
  }
  ```

---

## Architecture & Design Decisions

The included providers are fixtures for local development and tests. No real hotel supplier, OTA, booking API, or live hotel data source is configured.

```text
                       +-----------------------+
                       |      HTTP Client      |
                       +-----------------------+
                                   |
                                   v
                       +-----------------------+
                       |   Fastify / Router    |
                       +-----------------------+
                                   |
                         (Zod Schema Validation)
                                   |
                                   v
                       +-----------------------+
                       |   OfferOrchestrator   |
                       +-----------------------+
                                   |
                     +-------------+-------------+
                     |                           |
                     v                           v
          +--------------------+       +--------------------+
          |  Redis Cache Layer |       | Upstream Providers |
          +--------------------+       +--------------------+
          | - Canonical Key    |       | Provider A (Mock)  |
          | - Graceful Fallback|       | Provider B (Mock)  |
          +--------------------+       +--------------------+
                     |                           |
                     +-------------+-------------+
                                   |
                                   v
                       +-----------------------+
                       | Deduplication Engine  |
                       | - Case folding        |
                       | - Whitespace collapse |
                       +-----------------------+
                                   |
                                   v
                       +-----------------------+
                       |     HTTP Response     |
                       +-----------------------+
```

### 1. Hexagonal / Ports & Adapters Architecture

The core business logic (`OfferOrchestrator`) depends only on abstract interfaces:

- `HotelOfferProvider`: Any upstream provider (REST, SOAP, or mock) can be added by implementing `getOffers(criteria, signal)`.
- `OfferCache`: Abstracts caching operations (`get`, `set`, `ping`, `close`), allowing tests to execute in-memory with zero Docker dependency while production uses `RedisOfferCache`.

### 2. Canonical Cache Keys

To prevent cache fragmentation caused by URL parameter reordering, search criteria are normalized into a canonical object structure before hashing:
`hotel-offers:v1:{SHA256(canonical JSON string)}`

### 3. Redis Cache Behavior and Degradation

Redis is a best-effort cache, not the source of offer data:

- A successful complete provider aggregate is cached for `CACHE_TTL_SECONDS` (default 300 seconds). Partial aggregates are returned but not cached.
- Cache keys are based on normalized city, dates, and guest count. Invalid cached JSON or offer shapes are ignored and cause a live provider fetch.
- Redis connection/read/write failures are logged and searches fall back to provider results. Connection attempts use timeouts and a five-second retry cooldown.
- `/health` reports HTTP 503 with `degraded` status when Redis is unavailable, even though searches can still return live mock-provider results.

### 4. Deterministic Mock Providers

The repository includes two deterministic mock providers; neither connects to an external service:

- `direct-mock`: Models a direct supplier API.
- `marketplace-mock`: Models an OTA partner with formatting variance (e.g. `" sea   breeze resort "`).

---

## Testing & Verification

```bash
# Run all automated Vitest tests once
npm test -- --run

# Run the same suite with V8 coverage
npm run test:coverage

# Run static checks and build
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The current automated suite has 41 tests across four files:

- `test/app.test.ts`: Fastify route behavior using `app.inject`, including date/guest validation, health responses, in-memory cache hits, and provider errors.
- `test/offer-orchestrator.test.ts`: offer deduplication, cache behavior and invalid data, provider failures/recovery, and provider deadlines.
- `test/redis-cache.test.ts`: offline Redis handling and coordinated connection/close behavior using test doubles.
- `test/config.test.ts`: configuration defaults, overrides, and invalid values.

The suite uses in-memory caches or test doubles. Redis unit tests do not connect to an online Redis server. The tests do not make real network HTTP requests or establish Redis-backed HTTP cache behavior.

### Standalone Redis Smoke Test

With Redis running, this script checks Redis ping, a unique-key write with a 10-second TTL, read-back, and deletion:

```bash
npx tsx test/redis-smoke.ts
```

The script does not wait for or verify expiration, start the application, send HTTP requests, or verify the application's Redis cache-hit flow.

### Manual Redis-Backed HTTP Check

With Redis running and the app started (`npm run dev`, or `npm run build` followed by `npm start`), send the same valid search request twice to `http://localhost:3000/api/v1/hotels/offers`. Confirm the first response has `meta.source: "live"` and the second has `meta.source: "cache"`. Repeat with changed criteria to check key isolation. This is a manual check and is not performed by `npm test -- --run` or `test/redis-smoke.ts`; TTL expiry and outage/recovery also require separate live checks.

The test and build commands above are automated. HTTP requests against a running server, a Redis-backed cache-hit flow, and Redis TTL/outage/recovery checks are manual runtime checks and must be reported separately when run.
---

## Available Scripts

| Script          | Command                         | Purpose                                       |
| --------------- | ------------------------------- | --------------------------------------------- |
| `dev`           | `tsx watch src/server.ts`       | Start hot-reloading development server        |
| `build`         | `tsc -p tsconfig.json`          | Compile TypeScript into `dist/`               |
| `start`         | `node dist/src/server.js`       | Run compiled production server                |
| `typecheck`     | `tsc -p tsconfig.json --noEmit` | Strict type verification without emit         |
| `lint`          | `eslint .`                      | Lint source and test code with ESLint v9      |
| `format`        | `prettier --write .`            | Format all files according to Prettier config |
| `format:check`  | `prettier --check .`            | Check formatting compliance                   |
| `test`          | `vitest`                        | Run Vitest test runner                        |
| `test:coverage` | `vitest --coverage`             | Generate code coverage metrics via V8         |
