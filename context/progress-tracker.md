# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Not started — context files complete and confirmed, implementation not begun

## Current Goal

- Scaffold the monorepo (React + Vite frontend, Hono backend on Cloudflare Workers, Turso, shared types) with builds passing

## Completed

- 2026-07-14 - Removed dormant generated UI components, unused styling/config artifacts, and 43 unused runtime dependencies; synchronized the npm manifest with the lockfile

- 2026-07-14 — Context files authored from `MediFlow.pdf` and the pitch deck
- 2026-07-14 — Resolved core setup questions: no auth + role switcher, Gemini as the MVP LLM key, polling for live updates, Tailwind + shadcn/ui
- 2026-07-14 — Migrated package management from pnpm to npm, upgraded dependencies to current releases, generated `package-lock.json`, and verified a clean `npm ci` plus production build

- 2026-07-14 — Renamed the package metadata, application title, and README to MediFlow; removed legacy generated-project branding

## In Progress

- None yet.

## Next Up

1. Project scaffold: `frontend/` + `backend/` + `shared/`, GitHub CI, `npm run build` green
2. Data model + seeds: resources (3 doctors, 1 lab, 1 X-ray, 1 ECG) and 20–50 simulated patients with histories
3. Simulation clock + patient arrival / stage-completion events
4. Deterministic scheduling engine v1 — next-step recommendation per patient
5. Live Resource Dashboard v1 — resource status, queues, wait estimates (polling)
6. Queue prediction + bottleneck detection
7. LLM explanation layer, then pre-consultation summaries (Gemini)
8. Before/after impact metrics vs. uncoordinated baseline

## Open Questions

- **Priority levels** — patients have a "priority level", but its semantics (how many levels, how they weight scheduling order) are unspecified. Needs a product decision before engine v1
- **DB access layer** — Drizzle ORM vs. raw libSQL client for Turso. Default: Drizzle, unless overridden before the scaffold
- **Repo layout** — monorepo boundaries proposed in `architecture.md`. Default: as proposed, unless overridden before the scaffold
- **Baseline definition** — what "before" means for before/after metrics. Default: the same patient set run through naive FIFO with no orchestration

## Architecture Decisions

- **Deterministic rule-based scheduler; LLM is language-only** — explainable and safe for healthcare; no black-box medical decisions; no ML-training or dataset risk *(from the brief)*
- **Overlay architecture** — sits on top of existing hospital systems; consumes only resource status + service-duration estimates; low-friction adoption *(from the brief)*
- **Cloudflare Pages + Workers + Turso + GitHub** — the standard low-cost edge web stack specified in the brief
- **Simulated data only in the MVP** — no real patient records, no compliance surface *(from the brief)*
- **No auth in the MVP; client-side role switcher** (Staff / Doctor / Patient) — simulated data only, nothing sensitive served. Real auth becomes mandatory before touching real data *(decided 2026-07-14)*
- **Gemini is the MVP LLM key**, behind a provider-agnostic adapter so the provider can be swapped later *(decided 2026-07-14)*
- **Live updates via REST polling every few seconds** — simplest Workers-friendly option; WebSockets/Durable Objects deferred *(decided 2026-07-14)*
- **Tailwind CSS + shadcn/ui** as the component layer *(decided 2026-07-14)*

## Session Notes

- 2026-07-14: After cleanup, `npm ci` completed with zero vulnerabilities, `npm run build` passed, and the Vite development server returned HTTP 200 at `http://127.0.0.1:5173/`.
- 2026-07-14: Repository cleanup retained only the five reachable shadcn modules and removed the unused Figma asset resolver, duplicate theme file, empty CSS/PostCSS files, and their dependency-only component tree.

- 2026-07-14: All six context files filled from the two source PDFs; remaining *(proposed)* items are listed under Open Questions with defaults.
- 2026-07-14: User confirmed auth model (none + role switcher), LLM provider (Gemini), live updates (polling), and UI kit (shadcn/ui); `architecture.md`, `code-standards.md`, and `ui-context.md` updated accordingly.
- 2026-07-14: Package tooling standardized on npm (`npm@11.12.1`, Node.js `>=20.19.0`); removed the pnpm workspace/config, converted React to direct app dependencies, removed unused React-18-only Popper packages, and validated Vite 8 / React 19 with `npm ci` and `npm run build`.
- 2026-07-14: Standardized project-facing naming on MediFlow in package metadata, browser metadata, and README.
