# Architecture Decisions & Assumptions

This document outlines the architectural trade-offs, design rationales, and domain assumptions implemented in the Hotel Offer Orchestrator.

## 1. API Contract & Schema

- **Endpoint**: `GET /api/v1/hotels/offers`
- **Query Parameters**: `city` (string, 1-100 chars), `checkIn` (ISO date), `checkOut` (ISO date, after checkIn), `guests` (integer, 1-20).
- **Response Format**: JSend-inspired schema separating payload (`data: HotelOffer[]`) from operational telemetry (`meta: { source, providerCount, offerCount, cacheKey }`).
- **Rationale**: GET queries are naturally idempotent and cacheable. Clean separation of `data` and `meta` allows consumers to inspect cache telemetry without polluting the domain model.

## 2. Deduplication Policy

- **Normalization**: Hotel names are trimmed, whitespace-collapsed (`\s+` -> `' '`), and case-folded (`toLocaleLowerCase('en-US')`).
- **Conflict Resolution**: First-occurrence preservation (O(N) Set lookup). Deterministic order from provider arrays ensures reproducible results.

## 3. Provider Aggregation & Resilience

- **Concurrent Execution**: Upstream calls execute via `Promise.allSettled` to prevent one slow supplier from blocking others.
- **Timeout Isolation**: Each provider call is bounded by `PROVIDER_TIMEOUT_MS` using an `AbortController`.
- **Partial Failure Grace**: If at least one provider succeeds, the service returns successful offers. A 502 `PROVIDER_ERROR` is returned only when all providers fail.
- **Empty Inventory**: Empty provider results (`[]`) are valid business responses, not system failures.

## 4. Caching & Cache Invalidation

- **Canonical Key Generation**: Cache keys use SHA-256 digests over normalized, canonical criteria objects (`hotel-offers:v1:<sha256>`).
- **Non-blocking Fault Tolerance**: Cache read/write failures log warnings and fall back to live provider aggregation without dropping user requests.
- **Cache Poisoning Protection**: Aggregated results are only written to Redis if all configured providers responded successfully, preventing partial outages from being cached.
- **Cache Integrity Validation**: Cached JSON is schema-validated before deserialization; corrupt or malformed entries are discarded and refreshed.

## 5. Technology Choices

- **Fastify 5**: High-throughput HTTP framework with native schema compilation and structured logging.
- **Zod 3**: Strict runtime validation and type inference.
- **Node Redis 4**: Official Redis client with non-blocking connection management and clean shutdown support.
- **Vitest 3**: Fast native ESM unit and integration testing without container dependencies.
