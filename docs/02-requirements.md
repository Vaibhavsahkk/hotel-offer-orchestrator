# Requirements and Acceptance Criteria

## Fallback acceptance checklist (not an official assignment spec)

The full employer assignment was not found in the repository. The items below
describe the current implementation plan and invitation-based assumptions; reconcile
them with the official assignment before claiming compliance.

## Implemented fallback requirements

- Node.js backend written in TypeScript.
- HTTP endpoint for hotel-offer search.
- At least two provider adapters behind a common interface.
- Parallel provider aggregation.
- Deduplication by normalized hotel name.
- Redis cache read-through behavior.
- Configurable cache TTL.
- Request validation with useful 4xx errors.
- Dependency failure handling with useful 5xx errors.
- Health endpoint that reports process health and Redis state.
- Unit tests for normalization, deduplication, cache behavior, and provider failure isolation.
- Integration tests for HTTP contract.
- Docker Compose configuration for Redis.
- `.env.example`, README, and no committed credentials.

## Fallback behavior criteria

### Search flow

Valid search input reaches all configured providers concurrently. Successful offers are mapped to one internal model. Results are deduplicated by case-insensitive, trimmed hotel name. Results are returned in deterministic order.

### Cache flow

The service checks Redis before calling providers. Cache hit returns cached data and marks metadata as `cache`. Cache miss calls providers, writes successful aggregate result with TTL, and marks metadata as `live`. Cache key changes when location, dates, guests, or other response-affecting filters change.

### Failure flow

One failed provider does not erase successful offers from other providers. If all providers fail, return HTTP 502 with a stable error shape. Redis failure must not make the application unusable for live reads; log the cache error and continue, unless assignment instructions explicitly require fail-closed caching.

### Quality flow

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass. README explains local setup, API usage, design choices, testing, and trade-offs.
