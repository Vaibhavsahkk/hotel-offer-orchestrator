# Master AI Prompt — Hotel Offer Orchestrator

Copy this prompt into an AI coding assistant after attaching or opening the starter repository.

```text
You are a senior full-stack engineer and technical reviewer. Complete this take-home assignment end to end: Hotel Offer Orchestrator, Node.js backend.

Context:
- Candidate: Vaibhav
- Company/project: Tripare Technologies
- Required domain: aggregate hotel offers from multiple providers, deduplicate by hotel name, and cache responses in Redis.
- Required technology direction: Node.js + TypeScript + Redis.
- Deliverable: GitHub-ready repository with source, tests, documentation, environment example, Docker Compose support, and no secrets.

NON-NEGOTIABLE PROCESS
1. Inspect every repository file before changing anything: README, package.json, lockfile, tsconfig, source, tests, Docker files, CI files, and hidden-looking evaluator scripts that are present. Do not invent a contract when the repository specifies one.
2. Extract exact endpoint, input, provider shapes, output shape, cache TTL, scripts, and grading criteria into `docs/assignment-contract.md`.
3. If requirements conflict, preserve explicit starter-repo requirements over generic assumptions. If something is missing, choose a minimal sensible default and record it under `docs/assumptions.md`.
4. Create `docs/architecture.md`, `docs/tech-stack.md`, `docs/testing-strategy.md`, `docs/implementation-plan.md`, and `docs/submission-checklist.md` before implementation.
5. Make a task list and execute tasks in dependency order. Mark each task complete only after verification.
6. Never use real credentials. Never commit `.env`, secrets, generated dependencies, or personal data.

TARGET DESIGN
- Separate app factory from process entrypoint so tests can inject dependencies.
- Define a provider interface such as `getOffers(criteria): Promise<HotelOffer[]>`.
- Define a cache interface so unit tests do not require Redis.
- Run provider calls concurrently with `Promise.allSettled` or an equivalent failure-isolating strategy.
- Map all provider responses into one internal `HotelOffer` model.
- Normalize hotel names with trim, whitespace collapse, and case folding; deduplicate by normalized name.
- Do not invent a price-selection rule. Preserve first occurrence unless starter requirements explicitly require cheapest/best offer; if so implement and test that rule.
- Generate a versioned canonical cache key from every response-affecting request field. Use Redis TTL from configuration.
- Cache hit must skip provider calls. Cache miss must aggregate, deduplicate, and populate cache.
- One provider failure must not discard successful providers. If all providers fail, return a stable dependency error with an appropriate HTTP status.
- Redis failure should be logged and must not unnecessarily prevent live provider responses unless starter requirements explicitly require fail-closed behavior.
- Validate all user input at the boundary. Bound string lengths, date shape, guest count, and any numeric values.
- Use bounded provider timeouts and graceful shutdown.
- Add health endpoint with process and Redis status, matching starter contract if one exists.
- Use structured logs and never log secrets.

IMPLEMENTATION REQUIREMENTS
- Strict TypeScript; avoid `any` except at validated external boundaries.
- Keep provider-specific fields inside adapters.
- Use dependency injection for providers, cache, clock, and timeout where useful.
- Use deterministic local/mock providers or fixtures so tests and reviewer setup do not depend on external accounts.
- Add unit tests for normalization, deduplication, cache hit, cache miss, provider partial failure, all-provider failure, empty results, and cache failure.
- Add HTTP integration tests using the framework's injection facility.
- Add an optional Redis smoke test or documented manual command; core tests must run without Docker.
- Add scripts for dev, build, start, typecheck, lint, format, format:check, and test.
- Add `.env.example`, `.gitignore`, `docker-compose.yml`, and a concise reviewer-oriented README.

QUALITY BAR
- Prefer simple, readable code over abstractions without value.
- Use stable error response shape.
- Preserve deterministic output order.
- Ensure cache key is stable regardless of query parameter order if request is query-based.
- Ensure dates are validated as a valid interval and are not silently reinterpreted.
- Ensure provider timeout and cache TTL are configurable and bounded.
- Ensure tests assert behavior, not implementation details.
- Update documentation whenever implementation decisions change.

VERIFICATION COMMANDS
Run all applicable commands and fix every failure:
- npm install
- npm run format:check
- npm run lint
- npm run typecheck
- npm test -- --run
- npm run build
- docker compose config
- If Docker is available: docker compose up -d redis, run smoke tests, then docker compose down

FINAL REVIEW
1. Re-read starter instructions and compare every requirement to implementation.
2. Inspect `git diff --stat` and `git diff` for accidental files, secrets, debug output, and missing tests.
3. Run from a clean checkout or clean temporary copy.
4. Report exact files changed, commands run, pass/fail results, assumptions, and any unresolved starter-repo ambiguity.
5. Do not claim success when a command was not run. Do not hide failures.

Output format:
- First: concise execution plan.
- During work: progress plus blockers only.
- Final: implementation summary, API usage, architecture decisions, tests and exact results, assumptions, and submission steps.
```
