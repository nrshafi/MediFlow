# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 3 complete — persistent one-minute simulation clock and arrival/completion events verified

## Current Goal

- Resolve priority semantics, then build deterministic scheduling engine v1

## Completed

- 2026-07-15 - Added the persistent deterministic simulation clock, pure one-minute tick planning, atomic arrival/service-completion transitions, ordered audit events with concurrent-tick protection, and `GET /api/simulation` plus `POST /api/simulation/tick`; verified state transitions and HTTP responses through the generated migration with six passing backend tests

- 2026-07-15 - Added the normalized Turso/Drizzle schema, initial 15-table SQLite migration, canonical deterministic seed (3 doctors, lab, X-ray, ECG, and 30 simulated patients with histories), reset-and-seed CLI, database constraints/indexes, and migration/seed integration tests; added tests to CI and verified a clean install, all workspace checks/tests, and production builds

- 2026-07-15 - Documented local Worker secrets in `backend/.dev.vars.example` and expanded Git ignores to protect environment-specific `.dev.vars` and `.env` files

- 2026-07-15 - Scaffolded the npm-workspace monorepo with `frontend/`, `backend/`, and `shared/`; added the Hono Worker entry point, Turso/Drizzle client boundary, shared API/domain contracts, strict TypeScript checks, route-level frontend code splitting, and GitHub CI; verified all workspace checks and production builds

- 2026-07-14 - Added a project-scoped Codex connection to Cloudflare's official API MCP server, using OAuth and write-action approvals

- 2026-07-14 - Added manual previous/next minute controls beside simulation playback, with reversible state history and automatic pausing during manual steps
- 2026-07-14 - Removed the top-bar "ORCHESTRATION LIVE" status label
- 2026-07-14 - Removed the animated ECG pulse strip beneath the application top bar
- 2026-07-14 - Removed dormant generated UI components, unused styling/config artifacts, and 43 unused runtime dependencies; synchronized the npm manifest with the lockfile

- 2026-07-14 — Context files authored from `MediFlow.pdf` and the pitch deck
- 2026-07-14 — Resolved core setup questions: no auth + role switcher, Gemini as the MVP LLM key, polling for live updates, Tailwind + shadcn/ui
- 2026-07-14 — Migrated package management from pnpm to npm, upgraded dependencies to current releases, generated `package-lock.json`, and verified a clean `npm ci` plus production build

- 2026-07-14 — Renamed the package metadata, application title, and README to MediFlow; removed legacy generated-project branding

## In Progress

- None yet.

## Next Up

1. Resolve priority-level scheduling semantics
2. Deterministic scheduling engine v1 — next-step recommendation per patient
3. Live Resource Dashboard v1 — resource status, queues, wait estimates (polling)
4. Queue prediction + bottleneck detection
5. LLM explanation layer, then pre-consultation summaries (Gemini)
6. Before/after impact metrics vs. uncoordinated baseline

## Open Questions

- **Priority levels** — patients have a "priority level", but its semantics (how many levels, how they weight scheduling order) are unspecified. Needs a product decision before engine v1
- **Baseline definition** — what "before" means for before/after metrics. Default: the same patient set run through naive FIFO with no orchestration

## Architecture Decisions

- **npm-workspace monorepo** with `frontend/`, `backend/`, and `shared/` boundaries; the existing React prototype is preserved in the frontend workspace *(implemented 2026-07-15)*
- **Drizzle ORM over the libSQL client for Turso access**; database construction stays in `backend/src/db/` and credentials remain Worker bindings *(implemented 2026-07-15)*
- **Normalized Turso schema with committed Drizzle migrations**; static resources, mutable resource/queue state, patient services/timelines/history, simulation events, metric snapshots, and cached LLM text remain separate. Migrations and deterministic reset-seeding are Node-only development commands and never run in Worker requests *(implemented 2026-07-15)*
- **One-minute atomic simulation ticks**; the API never skips minutes or runs a background timer. Each tick records a unique clock event, completes due services, registers due arrivals, and leaves next-service selection to the scheduler. Event ordering is persisted and concurrent duplicate ticks roll back *(implemented 2026-07-15)*
- **Deterministic rule-based scheduler; LLM is language-only** — explainable and safe for healthcare; no black-box medical decisions; no ML-training or dataset risk *(from the brief)*
- **Overlay architecture** — sits on top of existing hospital systems; consumes only resource status + service-duration estimates; low-friction adoption *(from the brief)*
- **Cloudflare Pages + Workers + Turso + GitHub** — the standard low-cost edge web stack specified in the brief
- **Simulated data only in the MVP** — no real patient records, no compliance surface *(from the brief)*
- **No auth in the MVP; client-side role switcher** (Staff / Doctor / Patient) — simulated data only, nothing sensitive served. Real auth becomes mandatory before touching real data *(decided 2026-07-14)*
- **Gemini is the MVP LLM key**, behind a provider-agnostic adapter so the provider can be swapped later *(decided 2026-07-14)*
- **Live updates via REST polling every few seconds** — simplest Workers-friendly option; WebSockets/Durable Objects deferred *(decided 2026-07-14)*
- **Tailwind CSS + shadcn/ui** as the component layer *(decided 2026-07-14)*

## Session Notes

- 2026-07-15: Completed the simulation clock/event phase. A tick advances one minute and atomically updates clock, arrival registration/timeline state, active service/resource completion state, required-service completion, and ordered events. The read/tick endpoints are covered through the Hono app with an injected in-memory libSQL database. All workspace checks, six tests, and production builds pass.

- 2026-07-15: Completed the data-model and seed phase. The canonical seed is reproducible from integer seed `20260714`, contains 6 resources and 30 simulated patients, and can be reset idempotently after pending migrations are applied. `npm ci`, `npm run check`, `npm test`, and `npm run build` pass. Production dependencies audit clean; Drizzle Kit retains four moderate development-only advisories through its deprecated esbuild loader, with no non-breaking stable upgrade currently available.

- 2026-07-15: Completed the scaffold phase. `npm run check` passes for all three workspaces, and `npm run build` produces the Vite frontend bundle plus a successful Wrangler dry-run Worker bundle. Turso credentials are intentionally left for local/deployment environment configuration and are not required for the scaffold build.

- 2026-07-14: Added `.codex/config.toml` for the official `https://mcp.cloudflare.com/mcp` endpoint; Codex clients must restart and complete Cloudflare OAuth before first use.

- 2026-07-14: Simulation playback now records each deterministic minute (including individual minutes at 4× speed), allowing the top-bar previous/next controls to move one minute at a time; manual stepping pauses auto-run and reset clears the history.
- 2026-07-14: Removed the top-bar orchestration status label while retaining the shared pulse indicator used in staff and patient views.
- 2026-07-14: Removed the unused `EcgPulse` render and component after the animated SVG strip was removed from the top bar.
- 2026-07-14: After cleanup, `npm ci` completed with zero vulnerabilities, `npm run build` passed, and the Vite development server returned HTTP 200 at `http://127.0.0.1:5173/`.
- 2026-07-14: Repository cleanup retained only the five reachable shadcn modules and removed the unused Figma asset resolver, duplicate theme file, empty CSS/PostCSS files, and their dependency-only component tree.

- 2026-07-14: All six context files filled from the two source PDFs; remaining *(proposed)* items are listed under Open Questions with defaults.
- 2026-07-14: User confirmed auth model (none + role switcher), LLM provider (Gemini), live updates (polling), and UI kit (shadcn/ui); `architecture.md`, `code-standards.md`, and `ui-context.md` updated accordingly.
- 2026-07-14: Package tooling standardized on npm (`npm@11.12.1`, Node.js `>=20.19.0`); removed the pnpm workspace/config, converted React to direct app dependencies, removed unused React-18-only Popper packages, and validated Vite 8 / React 19 with `npm ci` and `npm run build`.
- 2026-07-14: Standardized project-facing naming on MediFlow in package metadata, browser metadata, and README.
