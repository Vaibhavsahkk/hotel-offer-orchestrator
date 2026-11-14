# Implementation Plan

## Phase 1 — Repository contract

Read starter README, package metadata, tests, and evaluator scripts. Preserve required API and commands. Record deviations only when unavoidable.

## Phase 2 — Foundation

Create strict TypeScript configuration, environment loader, Fastify app factory, error model, and domain types. Keep app creation separate from process startup for tests.

## Phase 3 — Provider and cache ports

Define `HotelOfferProvider` and `OfferCache` interfaces. Implement deterministic local providers and Redis adapter. Keep network and Redis dependencies injectable.

## Phase 4 — Orchestration

Normalize criteria, create canonical cache key, read cache, call providers concurrently on miss, isolate provider errors, flatten and deduplicate offers, write cache, and return metadata.

## Phase 5 — HTTP layer

Add search route, health route, validation, error mapping, request IDs, and graceful shutdown.

## Phase 6 — Verification

Run formatting, lint, typecheck, unit tests, integration tests, build, and manual curl checks against Docker Redis. Review secrets, README, package scripts, and Git diff.

## Definition of done

All required scripts pass; no credentials committed; Redis local setup works; cache hit skips provider calls; duplicate hotel names collapse; partial provider failure still returns successful offers; all-provider failure has stable 502 response; README enables a reviewer to run and evaluate in under five minutes.
