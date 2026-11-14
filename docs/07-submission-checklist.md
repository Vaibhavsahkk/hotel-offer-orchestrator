# Submission Checklist

## Code Quality & Functionality

- [x] `npm install` / `npm ci` works from clean checkout.
- [x] `npm run dev` starts the service in development mode.
- [x] `npm run build` compiles TypeScript to `dist/`.
- [x] `npm run lint` passes ESLint rules cleanly.
- [x] `npm run typecheck` passes strict TypeScript checks without errors.
- [x] `npm test -- --run` passes all 41 unit and integration tests.
- [x] Search route validates parameters, date formats, calendar correctness, and intervals.
- [x] Upstream providers run concurrently using `Promise.allSettled`.
- [x] Offers deduplicate by normalized hotel name (case-insensitive, trimmed).
- [x] Redis cache hit and miss flows verified with canonical SHA-256 keys.
- [x] Partial and total provider failure resilience verified.
- [x] Health route accurately reflects application and Redis connectivity.

## Repository Hygiene

- [x] `.env` is absent from Git history.
- [x] `.env.example` is present with documented configuration defaults.
- [x] `node_modules/`, `dist/`, `coverage/`, and temporary logs are properly ignored.
- [x] No API keys, secrets, or confidential data are in source files.
- [x] Docker Compose configuration for Redis is valid.
- [x] README includes quickstart, architecture, API documentation, and scripts.
- [x] Git commits contain only intentional, production-ready files.

## Reviewer Experience

- [x] Zero-credential setup: Deterministic mock providers allow immediate execution.
- [x] Offline resilience: Service operates even if Redis is not started.
- [x] Standalone Redis smoke test provided (`test/redis-smoke.ts`).
- [x] Clean, professional repository structure.
