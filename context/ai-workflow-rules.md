# AI Workflow Rules

## Approach

Build MediFlow incrementally using a spec-driven workflow. The context files — `project-overview.md`, `architecture.md`, `code-standards.md`, `ui-context.md`, and `progress-tracker.md` — define what to build, how to build it, and the current state of progress. Always implement against these specs — do not infer or invent behavior from scratch. Product truth comes from the MediFlow brief and pitch deck; anything they do not cover must be resolved in the context files before implementation.

## Scoping Rules

- Work on one feature unit at a time (e.g. "queue prediction endpoint", not "the whole dashboard")
- Prefer small, verifiable increments over large speculative changes
- Do not combine unrelated system boundaries in a single implementation step

## When to Split Work

Split an implementation step if it combines:

- Frontend (React views) and backend (Hono routes / engine) changes beyond the minimal wiring for one feature
- Deterministic engine logic and LLM adapter changes in the same step
- Database schema changes and feature logic in the same step
- Behavior not clearly defined in the context files

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files
- If a requirement is ambiguous, resolve it in the relevant context file before implementing
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing
- Never weaken an invariant in `architecture.md` to make an implementation easier — especially: the LLM never makes scheduling or clinical decisions

## Protected Files

Do not modify the following unless explicitly instructed:

- `frontend/src/components/ui/*` — generated component-library files
- Applied database migrations — create new migrations instead of editing old ones
- Lockfiles and generated config (`package-lock.json`, Wrangler config) beyond documented, deliberate changes
- Any third-party library internals

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `architecture.md`
- Storage model or schema decisions → `architecture.md`
- Code conventions or standards → `code-standards.md`
- Feature scope → `project-overview.md`
- Visual tokens or layout patterns → `ui-context.md`
- Every meaningful change → `progress-tracker.md`

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated — especially: scheduling stayed deterministic and LLM-free
3. `progress-tracker.md` reflects the completed work
4. `npm run build` passes in every affected workspace (frontend and backend)
