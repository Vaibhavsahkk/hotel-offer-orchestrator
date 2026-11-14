# Architecture

## Shape

```text
HTTP request
    |
    v
Fastify route -> Zod validation -> OfferOrchestrator
                                      |
                 +--------------------+--------------------+
                 |                    |                    |
                 v                    v                    v
             Redis cache       Provider A             Provider B
                 |                    \                    /
                 +---------------------\------------------+
                                       v
                              normalize + deduplicate
                                       |
                                       v
                                  HTTP response
```

## Boundaries

`routes` owns transport concerns and maps application errors to HTTP status codes. `services` owns orchestration, cache policy, and deduplication. `providers` owns external-provider contracts and mapping into the internal offer model. `cache` owns Redis access and serialization. `types` owns stable domain types. `utils` owns configuration, logging, and shared helpers.

## Domain model

An `HotelOffer` contains `hotelName`, `price`, `currency`, `source`, and `available`. Provider-specific fields never leak beyond provider adapters. `SearchCriteria` contains normalized city, ISO dates, and positive guest count.

## Deduplication rule

Normalize hotel name with Unicode-aware trim, collapsed whitespace, and lowercase. Keep first occurrence. This produces predictable output and avoids silently inventing a price-selection policy not stated in the brief. If the starter repo explicitly requires cheapest-offer selection, change the reducer and add a test.

## Cache policy

Use a versioned prefix and SHA-256 of canonical JSON criteria. Store only response
data, not request metadata. Use `SET key value EX ttl`. Cache read failures and
invalid cached payloads are treated as misses. Cache failures are observable but
non-blocking for live provider requests. Partial provider aggregates are not cached;
they are retried against all providers on the next request.

## Resilience

Provider calls run concurrently under a deadline. At timeout the orchestrator aborts
the provider signal and rejects its wait. Providers that ignore the signal may
continue their own underlying work. `Promise.allSettled` isolates failures. At least
one successful provider is enough for a live response. All-provider failure becomes
an application error. Redis connection attempts are shared across concurrent cache
operations; shutdown prevents new attempts and waits for an in-flight connection
attempt before closing the client.

The configured local providers are deterministic mocks. Whether they satisfy the
employer's assignment is unverified.

## Security

Validate and bound query inputs. Do not log secrets or full user-controlled payloads. Restrict CORS only if required; avoid enabling broad CORS by default. Run container as non-root when packaging production image.
