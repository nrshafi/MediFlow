# Architecture Context

## Stack

| Layer        | Technology                                                    | Role                                                       |
| ------------ | ------------------------------------------------------------- | ---------------------------------------------------------- |
| Frontend     | React + TypeScript (Vite)                                     | Staff dashboard, patient guidance view, doctor brief view  |
| Charts       | Chart.js                                                      | Queue, wait-time, and utilization visualizations           |
| Backend      | Hono (TypeScript) on Cloudflare Workers                       | REST API, scheduling engine, simulation, LLM adapter       |
| Database     | Turso (edge-hosted SQLite / libSQL) + Drizzle ORM             | Resources, patients, queue state, events, metric snapshots |
| LLM          | Gemini API (single key, behind a provider-agnostic adapter)   | Natural-language explanations + pre-consultation summaries |
| Live updates | REST polling (every few seconds)                              | Keeps dashboard and patient views current — no WebSockets  |
| Hosting & CI | Cloudflare Pages (frontend), Cloudflare Workers (API), GitHub | Deployment, version control, CI                            |

Vite is the confirmed frontend build tool.

## System Boundaries

- `frontend/` — React app. Renders what the API returns via a shared polling data layer; never computes scheduling decisions client-side
- `backend/src/routes/` — Hono route handlers: validate input, call engine/services, shape responses. Thin.
- `backend/src/engine/` — deterministic rule-based scheduler, queue prediction, bottleneck detection. Pure functions: no DB, network, or LLM calls inside
- `backend/src/llm/` — provider-agnostic LLM adapter + prompts for explanations and pre-consultation summaries. The only module that talks to the LLM API
- `backend/src/db/` — Turso schema, queries, seed/simulation data
- `shared/` — domain types and API contracts imported by both frontend and backend

The npm-workspace monorepo layout was implemented on 2026-07-15.

## Storage Model

- **Turso (SQLite)**: everything persistent — resource definitions (3 doctors, 1 lab, 1 X-ray, 1 ECG) and live status, simulated patients with medical histories, queue/visit state, scheduling events, cached LLM outputs, metric snapshots
- **Normalized operational schema**: static resource definitions are separated from mutable resource state and queue positions; patient identity/visit state is separated from required services, timeline entries, and the five medical-history record types. Simulation events, metric snapshots, and cached LLM text use append-oriented tables so scheduling decisions remain auditable.
- **Development lifecycle**: Drizzle Kit generates committed SQLite migrations from `backend/src/db/schema.ts`; a Node-only seed command applies pending migrations and replaces simulation data with the canonical deterministic fixture. Worker request code never runs migrations or seeds.
- **No blob/file storage**: the MVP produces no files or media; LLM outputs are short text stored inline
- **Simulated data only**: seed scripts generate all patients and histories — no real patient records anywhere

## Simulation Tick Semantics

- `POST /api/simulation/tick` advances the persistent clock by exactly one simulated minute. Playback speed remains a client concern: 4× playback issues ticks more frequently rather than skipping intermediate minutes.
- Each tick is planned deterministically from the current persisted state and applied as one atomic libSQL batch. A unique `clock_advanced` event for the target minute provides optimistic concurrency protection, so concurrent requests cannot advance the same minute twice.
- Within a minute, the clock event is recorded first, due active services are completed in patient-ID order, and newly due arrivals are registered in patient-ID order. Event rows carry an explicit order within their simulation minute.
- Completing a service clears the patient/resource active-service state, closes the open timeline entry, and marks the matching required service complete. It does **not** choose or queue the next service; that remains the deterministic scheduling engine's responsibility in the following feature unit.
- `GET /api/simulation` returns the persisted clock plus patient counts. No request handler owns a timer or performs background work.

## Auth and Access Model

- No real authentication in the MVP *(decided 2026-07-14)* — the system serves simulated data only, so nothing sensitive is exposed
- A client-side role switcher selects the view: Staff dashboard / Doctor brief / Patient guidance
- Revisit before any deployment that touches real hospital data — real auth becomes mandatory then
- Secrets (LLM API key, Turso credentials) live in Cloudflare Workers environment variables — never in code, the repo, or the client
- All traffic over HTTPS/TLS

## Invariants

1. **The LLM never makes a scheduling or clinical decision.** It only explains decisions already made by the deterministic engine and summarizes patient records. Removing the LLM must leave scheduling behavior unchanged.
2. **The scheduling engine is deterministic and explainable.** Same input state → same recommendation. No ML models, no unseeded randomness.
3. **MediFlow is an overlay, not a management system.** It never owns HMS/EMR concerns (appointments, billing, records management). It consumes only resource status and service-duration estimates.
4. **Simulated data only in the MVP.** No real patient records enter the system.
5. **Secrets live in environment variables** — never in code or version control.
6. **Request handlers do not run long-lived background work.** Recalculation is event-driven (arrival, stage completion, simulation tick) within Workers' short request cycles — no daemons.
