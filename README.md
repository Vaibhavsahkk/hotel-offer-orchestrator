# Hotel Offer Orchestrator

A high-performance Node.js & TypeScript backend service that concurrently aggregates hotel offers from multiple providers, deduplicates offers by normalized hotel name, and caches aggregate responses in Redis with automatic fault tolerance and graceful degradation.

---

## Features

- **Concurrent Provider Aggregation**: Queries multiple upstream hotel providers in parallel using `Promise.allSettled`, isolating failures so slow or failing providers do not block healthy ones.
- **Smart Offer Deduplication**: Normalizes hotel names (trimming, whitespace collapsing, and case-folding) to eliminate duplicate listings across providers.
- **Read-Through Redis Caching**: Hashes canonical normalized search criteria using SHA-256 to guarantee stable cache keys regardless of query parameter ordering.
- **Cache Integrity & Partial Failure Handling**: Only caches aggregates when all providers succeed, ensuring transient provider outages do not poison the cache with partial inventory.
- **Resilient & Non-Blocking Cache Fallback**: Automatically degrades to live provider queries if Redis is offline or unreachable, with connection throttling to avoid connection storms.
- **Strict Input & Calendar Validation**: Validates query parameters against Gregorian calendar rules (rejecting non-existent dates like `2026-02-31`) and enforces logical check-in/check-out ordering.
- **Production-Ready Hygiene**: Structured logging via Fastify/Pino, graceful shutdown on `SIGINT`/`SIGTERM`, and 100% self-contained mock providers for zero-dependency reviewer evaluation.

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

Queries providers concurrently, deduplicates offers, and caches the result.

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

_Subsequent identical requests return `"meta": { "source": "cache", ... }`._

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

### 3. Graceful Redis Degradation

Redis outages must never take down the hotel search experience. When Redis is unavailable:

- `RedisOfferCache` implements a connection timeout (1s) and a cooldown circuit breaker (5s) to avoid blocking request loops.
- Search requests fall back cleanly to live provider aggregation.
- Health checks return HTTP 503 `degraded` so infrastructure load balancers can track dependency health.

### 4. Deterministic Mock Providers

To enable automated testing and evaluation without requiring proprietary third-party API keys, the repository includes two deterministic mock providers:

- `direct-mock`: Models a direct supplier API.
- `marketplace-mock`: Models an OTA partner with formatting variance (e.g. `" sea   breeze resort "`).

---

## Testing & Quality Gates

The test suite includes 41 automated tests covering unit logic, integration endpoints, offline fallbacks, and boundary conditions.

```bash
# Run unit & integration tests once
npm test -- --run

# Run tests with code coverage report
npm run test:coverage

# Run TypeScript type check
npm run typecheck

# Run ESLint check
npm run lint

# Check code formatting
npm run format:check
```

### Coverage Overview

- **Line Coverage**: ~93%
- **Function Coverage**: ~94%
- **Core Orchestrator & Criteria**: 100%

### Standalone Redis Smoke Test

A standalone script is provided to verify live Redis read, write, expiration, and deletion against an active Docker container:

```bash
npx tsx test/redis-smoke.ts
```

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
