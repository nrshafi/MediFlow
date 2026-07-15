# Code Standards

## General

- Keep modules small and single-purpose — engine, simulation, routes, LLM adapter, and UI are separate concerns
- Determinism first: business logic is pure and unit-testable; side effects (DB, LLM, clock) stay at the edges
- Fix root causes, do not layer workarounds
- Do not mix unrelated concerns in one component or route

## TypeScript

- Strict mode required throughout (frontend, backend, shared)
- Avoid `any` — model the domain with explicit types (`Patient`, `Resource`, `QueueEntry`, `Recommendation`, `BottleneckAlert`)
- Validate unknown external input at system boundaries before trusting it — API request bodies and LLM responses (e.g. Zod with Hono's validator)
- Shared domain and API contract types live in `shared/` — never duplicate them on either side

## React (frontend)

- Function components and hooks only
- All server state (queues, resources, metrics) flows through one polling data layer (refetch every few seconds) — components never fetch ad hoc
- The frontend renders decisions; it never re-implements engine logic client-side
- Keep the three views (dashboard, patient guidance, doctor brief) isolated — shared pieces go to `components/`

## Hono (backend)

- Route handlers stay thin: validate → call engine/service → return shaped response
- The scheduling engine is pure: no DB, network, or LLM calls inside `engine/`
- All LLM calls go through the single adapter in `llm/`, with timeouts and graceful fallbacks — prompts live with the adapter, never inline in routes
- Handlers do not run long-lived background work (Cloudflare Workers constraint)

## Styling

- Use the CSS custom property tokens from `ui-context.md` — no hardcoded hex values in components
- Tailwind utilities; follow the radius and typography scales defined in `ui-context.md`
- Chart.js colors must come from the same tokens

## API Routes

- Validate and parse request input before any logic runs
- Return consistent shapes: `{ data }` on success, `{ error: { code, message } }` on failure — never leak stack traces or secrets
- Keep each route focused on a single responsibility

## Data and Storage

- All persistent state belongs in Turso (SQLite) — resources, patients, queue state, events, metric snapshots
- Simulated data only: seed scripts generate patients and histories; no real records, ever
- Cache LLM outputs (explanations, summaries) by patient, kind, and deterministic source hash instead of regenerating on polling reads
- No secrets in the database, code, or repo — environment variables only

## File Organization

- `frontend/src/views/` — dashboard, patient guidance, and doctor brief screens
- `frontend/src/components/` — reusable UI components (`components/ui/` for generated library components)
- `frontend/src/lib/` — API client, polling/data layer, helpers
- `backend/src/routes/` — Hono route handlers
- `backend/src/engine/` — deterministic scheduler, queue prediction, bottleneck detection
- `backend/src/llm/` — LLM adapter and prompts
- `backend/src/db/` — schema, queries, seeds
- `shared/` — cross-cutting domain types and API contracts

This layout is implemented as an npm-workspace monorepo.
