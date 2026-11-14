# Hotel Offer Orchestrator — Problem Analysis & Scope

## 1. Problem Statement

Tripare Full Stack Node.js Developer Technical Assignment:

> **Hotel Offer Orchestrator (Node.js / TypeScript + Redis)**
> Concurrently aggregate hotel offers from multiple providers, deduplicate offers by normalized hotel name, and cache results in Redis. Submit via GitHub repository.

## 2. Functional Objectives

- **API Endpoint**: Expose an HTTP GET endpoint (`/api/v1/hotels/offers`) accepting hotel search parameters (`city`, `checkIn`, `checkOut`, `guests`).
- **Concurrent Aggregation**: Query multiple providers in parallel with failure isolation.
- **Deduplication Engine**: Normalize hotel names (trimming, whitespace collapse, case-folding) and deduplicate across provider results.
- **Read-Through Caching**: Cache aggregated responses in Redis using versioned, canonical SHA-256 criteria keys.
- **Fault Tolerance**: Fall back to live provider responses if Redis is unavailable; report degraded service via a `/health` endpoint.

## 3. Key Design Decisions

1. **Non-blocking Cache Degradation**: A Redis outage degrades performance to live reads rather than breaking the user search flow.
2. **Deterministic Upstream Providers**: Includes self-contained mock providers (`direct-mock` and `marketplace-mock`) to allow reviewers to run and test the complete pipeline immediately with zero external credentials.
3. **Partial Failure Isolation**: When one provider times out or fails, remaining provider results are returned live, but not cached, preventing partial inventory from polluting the cache.
4. **Strict Calendar Validation**: Gregorian calendar bounds validation prevents invalid dates (such as `2026-02-31`) from entering downstream processing.
