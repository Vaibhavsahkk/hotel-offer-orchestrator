# Testing Strategy

Test domain behavior without network or Redis. Inject fake providers and fake cache into the orchestrator.

Cover criteria normalization, canonical cache-key stability, hotel-name
normalization, duplicate removal, deterministic order, cache hit short-circuiting,
cache miss population, malformed and structurally invalid cached data, cache read
and write failures, provider failure isolation, timeouts with cooperative and
uncooperative providers, late provider rejection, partial-provider recovery, empty
successful providers, invalid calendar dates, malformed input, and Redis connection
concurrency/shutdown.

Use Fastify `inject` for HTTP integration tests. Verify status codes, response body,
and health behavior. Run a Redis smoke test when Docker is available; unit tests must
not require Docker. Memory-cache tests do not prove Redis server integration. Verify
live Redis cache hits, TTL, expiry, outage, and recovery separately.

Quality gates:

```text
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Manual smoke test:

```text
docker info
docker compose up -d redis
npm run dev
curl "http://localhost:3000/api/v1/hotels/offers?city=Goa&checkIn=2026-12-20&checkOut=2026-12-22&guests=2"
curl http://localhost:3000/health
npx --no-install tsx test/redis-smoke.ts
```
