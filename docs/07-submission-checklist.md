# Submission Checklist

Before submission, compare implementation against starter repo and replace fallback assumptions with exact evaluator contract.

## Code

- [ ] `npm install` works from clean checkout.
- [ ] `npm run dev` starts service.
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` succeeds.
- [ ] `npm run typecheck` succeeds.
- [ ] `npm test -- --run` succeeds.
- [ ] Search route validates input.
- [ ] Providers run concurrently.
- [ ] Offers deduplicate by hotel name.
- [ ] Redis cache hit and miss behavior verified.
- [ ] Partial and total provider failure behavior verified.
- [ ] Health route works.

## Repository hygiene

- [ ] `.env` absent from Git.
- [ ] `.env.example` present.
- [ ] `node_modules`, build output, logs, and coverage ignored.
- [ ] No API keys, passwords, or personal data.
- [ ] Docker Compose Redis works.
- [ ] README includes commands, API examples, architecture, assumptions, and trade-offs.
- [ ] Git diff contains only intentional files.

## Reviewer experience

- [ ] Fresh clone setup documented.
- [ ] Tests do not require external provider accounts.
- [ ] Default provider behavior deterministic.
- [ ] Hidden assignment contract checked against starter files.
- [ ] Commit history and repository name are professional.
- [ ] Final GitHub URL tested in private/incognito clone if possible.
