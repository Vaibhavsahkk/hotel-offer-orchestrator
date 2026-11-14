# Technology Stack

| Concern     | Choice                                  | Reason                                                                      |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Runtime     | Node.js 22 LTS                          | Current supported runtime with native fetch and strong TypeScript ecosystem |
| Language    | TypeScript 5                            | Strict domain contracts and safer refactoring                               |
| HTTP        | Fastify 5                               | Small, fast, schema-friendly backend framework                              |
| Validation  | Zod 4.6.7                               | Runtime validation with inferred types                                      |
| Redis       | `redis` 4                               | Official Node Redis client, simple deployment model                         |
| Tests       | Vitest 4.1.12                           | Fast unit and integration test runner                                       |
| Lint/format | ESLint 9 + typescript-eslint + Prettier | Repeatable quality gates                                                    |
| Build       | `tsc`                                   | Minimal production build with no framework lock-in                          |
| Local infra | Docker Compose Redis 7                  | Reproducible local cache dependency                                         |
| Logging     | Pino via Fastify                        | Structured logs with low overhead                                           |

## Runtime configuration

`PORT=3000`, `HOST=0.0.0.0`, `REDIS_URL=redis://localhost:6379`, `CACHE_TTL_SECONDS=300`, `PROVIDER_TIMEOUT_MS=2500`, and `NODE_ENV=development`.

The application reads configuration from `process.env`; it does not load `.env`
files. `.env.example` documents variable names and default values. Use shell
environment variables for development and production commands as shown in the
README. Deterministic local mock providers are currently configured. Whether mocks
meet the employer's requirements is unverified.
