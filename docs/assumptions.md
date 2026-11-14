# Assumptions

The official assignment and starter repository contract were not found in this
workspace. These are implementation decisions, not confirmed employer requirements.
Compare them with the official assignment before submission.

## API Contract

- Endpoint: `GET /api/v1/hotels/offers`
- Query parameters: `city`, `checkIn`, `checkOut`, `guests`
- Response shape: `{ data: HotelOffer[], meta: { source, providerCount, offerCount, cacheKey } }`

## Deduplication

- First occurrence wins when duplicate hotels have different prices. No cheapest/best-offer selection unless starter repo explicitly requires it.

## Provider Behavior

- Providers are called concurrently with `Promise.allSettled`
- One provider failure does not discard successful providers
- Empty results from a successful provider are valid (not treated as failure)
- Cache write failure is non-blocking — live response still returned

## Cache

- Redis read failures are treated as misses; writes are skipped with a warning
- Cache key is versioned (`v1`) and uses SHA-256 of canonical JSON criteria
- TTL is configurable via `CACHE_TTL_SECONDS` (default 300s)
- Malformed or structurally invalid cached offers are treated as misses and refreshed
- Partial provider results are returned live but not cached so the next request can
  query a recovered provider

## Framework

- Fastify 5 is used as the HTTP framework
- Zod 4.6.7 is used for runtime validation
- `redis` 4 is used as the Node Redis client

## Testing

- Core tests use `MemoryOfferCache` and do not require Docker
- Redis smoke test is provided as a separate script
- Tests assert behavior, not implementation details
- Real Redis cache behavior was checked using an isolated temporary Redis instance;
  results are recorded in `PRE_GITHUB_VERIFICATION_REPORT.md`. These checks are
  separate from the automated MemoryOfferCache test suite.

## Environment

- Node.js 22+
- TypeScript 5 with strict mode
- Docker Compose for local Redis
- `.env.example` is documentation only; the app reads `process.env` and does not
  automatically load `.env`
