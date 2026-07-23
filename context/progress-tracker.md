# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 11 complete — session Gemini credential verification; demo reset requires its dedicated credential

## Current Goal

- User-provided Gemini credentials are accepted only after Gemini verifies them and cannot authorize demo reset

## Completed

- 2026-07-24 - Rebuilt typography system from scratch using standard modern web application standards (Vercel, Linear, GitHub, Stripe): loaded full Inter variable font (100-900 weights) & JetBrains Mono in `fonts.css`, re-established standard weight hierarchy (400 Regular body, 500 Medium buttons/labels, 600 SemiBold cards/tags, 700 Bold headers), applied modern tracking (`-0.02em` on large metrics and headers), and replaced ad-hoc monospace styling across UI components with clean proportional `font-sans` typography.

- 2026-07-22 - Updated Section 6 ("Technical Complexity & Engineering Architecture") in [docs/faq.md](file:///i:/Development/AI_Hackathon/MediFlow/docs/faq.md) to explicitly contrast the Demo Version (Cloudflare Workers, Turso, synthetic simulation clock) with the Real-World Production Architecture (on-premise hospital local server hosting, local DB, local HMS hooks, local LLM/LAN air-gapping).

- 2026-07-22 - Expanded `docs/faq.md` with comprehensive operational, technical, performance, accessibility, and Judge Pitch presentation defense Q&As (covering deterministic vs RL/ML justification, data privacy/HIPAA, missed turns, zero-hardware costs, and empirical proof of wait-time reduction).

- 2026-07-22 - Upgraded `RoleSwitcher` in `Shell.tsx` to Option 2 (Dynamic Pill layout): replaced static text tabs with dynamic icon pills (`Building2` for Staff, `Stethoscope` for Doctor, `User` for Patient) that expand to show uppercase text labels for the active tab, and added bottom tooltips for all role switcher buttons.

- 2026-07-22 - Removed the GuardrailNote warning element ("⚠ THE LLM NEVER MAKES A SCHEDULING OR CLINICAL DECISION.") and its references from `primitives.tsx`, `StaffDashboard.tsx`, and `DoctorBrief.tsx`.

- 2026-07-22 - Fixed title bar icon and browser favicon branding by adding dedicated SVG (`favicon.svg`), 32x32 ICO/PNG (`favicon.ico`, `favicon-32x32.png`), and Apple touch icon assets to `frontend/public/` and root `public/`, adding cache-busting version parameters (`?v=mediflow`) in `frontend/index.html` to force browser tab icon refresh, and adding a matching gradient logo icon mark beside the MediFlow brand name in `Shell.tsx` `TopBar`.

- 2026-07-22 - Fixed unnecessary horizontal scrollbar in `StageStepper` by adding horizontal/vertical element padding (`px-5 sm:px-6 pt-4 pb-2`) to contain active step `animate-ping` keyframe scale expansion, adding `pointer-events-none` to the ping element, and adding `.no-scrollbar` styling across `PatientGuidance` and `StaffDashboard`.

- 2026-07-22 - Fixed top-clipping of active step circle `animate-ping` pulse animation in `StageStepper` by adding top padding (`pt-3.5 pb-2` / `px-3.5`) to `StageStepper` and updating `overflow-x-auto` wrapper padding across `StaffDashboard` and `PatientGuidance`.

- 2026-07-22 - Categorized hospital resources on StaffDashboard into distinct sub-sections ("DOCTORS & MEDICAL STAFF" and "DIAGNOSTICS & LAB FACILITIES") with count badges; enhanced ResourceCard with category tags (DOCTOR / DIAGNOSTIC) and Lucide icons (Stethoscope, FlaskConical, Scan, Activity)

- 2026-07-22 - Enhanced visual contrast and surface depth across theme.css and ui-context.md: deepened background slate contrast (#EEF2F6), sharpened card borders (#CBD5E1), intensified muted text legibility (#334155 / Slate-700), saturated primary accents (#0284C7), and added card elevation shadows

- 2026-07-22 - Updated typography configuration across theme.css and ui-context.md to alias `--font-mono` to `--font-sans` (`Inter`), removing all monospace font rendering across the application

- 2026-07-22 - Transitioned MediFlow design system from dark theme to a high-contrast Light Clinical theme across CSS variables, shadcn/radix token aliases, Chart series colors, and ui-context.md documentation

- 2026-07-22 - Configured complete set of Cloudflare MCP servers in `.codex/config.toml` & `.vscode/mcp.json`, installed 11 official Cloudflare agent skills (`npx skills add cloudflare/skills`), and completed Wrangler CLI authentication

- 2026-07-22 - Installed official `@cloudflare/mcp-server-cloudflare` package into root `devDependencies` and verified `.codex/config.toml` configuration and workspace TypeScript checks

- 2026-07-16 - Added `docs/calculations.md`, documenting the deterministic routing formula, queue and wait rules, resource utilization and congestion thresholds, dashboard metric aggregation, baseline calculation, and the LLM's non-decision boundary

- 2026-07-16 - Added `docs/technical-walkthrough.md` plus four Mermaid source diagrams under `docs/diagram/` covering the system, scheduler, patient state, and language-only AI boundary; documented the presentation narrative and a staged real-world overlay integration path

- 2026-07-16 - Refreshed all five judge-walkthrough captures against the current frontend and production API, selected a stronger patient-guidance example, captured the actionable Doctor controls and completed-day status, expanded the final-impact frame to include comparison charts, synchronized the talk track, and restored the shared demo to minute zero

- 2026-07-16 - Added 10× client-side simulation playback alongside 1× and 4× while preserving one-minute API ticks

- 2026-07-16 - Removed the session Gemini-key demo-reset authorization exception. Reset now always requires the dedicated demo reset credential, while session keys remain available only for Gemini language features.

- 2026-07-16 - Added a read-only Gemini model check before a user-provided key enters React memory, surfaced inline verification failures, and added success, invalid-key, and transient-failure coverage

- 2026-07-16 - Completed the actionable-control audit: replaced the inert Doctor Brief consultation/skip controls with patient-guidance navigation and queue selection, deep-linked the Patient view to the selected patient, replaced permanently disabled completed-day playback controls with a status badge, made empty key forms return inline validation instead of gray submit buttons, and added keyboard/accessible labels to adjacent patient controls

- 2026-07-15 - Added a session-only Gemini API key fallback: the top bar accepts and clears a key held only in React memory, sends it only on Gemini-capable requests, validates it at the Worker boundary, prefers the configured Worker secret, and never logs or persists the supplied key; added precedence, fallback, validation, and CORS coverage

- 2026-07-15 - Rehearsed the judge-facing walkthrough end to end against production, captured the reset, live Staff, Patient, Doctor, and final-impact states, documented a four-minute talk track and recovery cues, verified 30/30 completion at minute 240, and restored the shared demo to minute zero

- 2026-07-15 - Deployed the formatted Doctor Brief UI and Worker prompt/cache update; production Gemini smoke testing returned six labeled lines with no Markdown markers, and the live Pages Doctor Brief chunk contains the safe section formatter

- 2026-07-15 - Added a safe brief formatter that converts existing Gemini Markdown markers and the new line-based response format into labeled clinical rows without injecting HTML; constrained future Gemini briefs to six plain-text categories, versioned the source hash to invalidate old cached output, and aligned deterministic fallbacks with the same structure

- 2026-07-15 - Deployed the protected reset Worker and production Pages bundle, verified the public site and API return HTTP 200, rejected an invalid reset credential with HTTP 401, exercised reset → tick → reset against production, confirmed a Gemini doctor brief, and left the shared 30-patient demo at minute zero

- 2026-07-15 - Added a demo-only, bearer-protected reset flow: the Worker atomically restores the canonical minute-zero fixture without running migrations, the Staff view requests the credential at action time without bundling or persisting it, completed simulations disable further ticks, and reset/CORS behavior is covered by backend tests

- 2026-07-15 - Completed deterministic before/after metrics with a fixed-order FIFO baseline and per-tick live snapshots for wait, visit duration, utilization, average queue depth, and peak queue depth; added a second committed migration without modifying the applied initial migration

- 2026-07-15 - Added the provider-agnostic Gemini language adapter with current `generateContent` REST integration, timeouts, source-hash caching, deterministic graceful fallbacks, recommendation explanations generated at the tick edge, and on-demand pre-consultation record summaries

- 2026-07-15 - Completed full-day acceptance coverage: all 30 patients and every required service finish, consultation load is balanced across interchangeable simulated doctors, all five impact measures improve against baseline, cached Gemini output is returned through polling, all 15 tests pass, all workspaces build, and the production frontend returns HTTP 200

- 2026-07-15 - Implemented deterministic scheduling engine v1 with earliest-projected-completion routing, binary non-preemptive priority queues, FIFO and stable tie-breakers, automatic service starts/rerouting/completion, wait/service/utilization accumulation, queue predictions, congestion alerts, recommendation events, and pure plus persistent integration tests

- 2026-07-15 - Added the shared `GET /api/operations` snapshot for resources, queues, patients, histories, recommendations, alerts, and live metrics; replaced the browser-only simulator with one API polling layer and persistent tick controls across the staff, patient, and doctor views; removed pharmacy/billing from the MVP flow UI

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

- None.

## Next Up

1. Add production monitoring/alert review and restrict CORS plus public mutation access before broader sharing
2. Revisit authentication before any real-data integration

## Open Questions

- None for the simulated-data MVP.

## Architecture Decisions

- **Verified session-only Gemini key fallback** — an explicitly entered key is checked through Gemini's read-only model endpoint before it enters React memory, kept only in memory, and sent via `X-Gemini-Api-Key` on Gemini-capable requests; the Worker never stores or logs it, and a configured `GEMINI_API_KEY` always takes precedence *(implemented 2026-07-16)*

- **Binary non-preemptive priority semantics** — urgent patients precede normal patients in each resource queue; equal-priority patients use FIFO with patient ID as the final deterministic tie-breaker. Active services are never interrupted *(decided 2026-07-15)*
- **Fixed-order FIFO baseline** — the identical fixture uses lab → X-ray → ECG → consultation, skips unneeded services, and applies naive FIFO without priority or reordering *(implemented 2026-07-15)*
- **Interchangeable simulated consultations** — engine v1 may balance consultation work across the three demo doctors because no clinical suitability requirements exist in simulated data; this must be revisited before real integration *(implemented 2026-07-15)*
- **Gemini language adapter with deterministic fallback** — Gemini rewrites scheduling facts and summarizes records only; timeouts or missing credentials never change engine behavior *(implemented 2026-07-15)*

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

- 2026-07-16: Judge storyboard captures now reflect the session-key control, P-006's four-minute consultation guidance, the Doctor view's patient-guidance and next-queue actions, and the Staff view's completed-day badge. The final frame includes the KPI strip and comparison charts; production demo data was reset to minute zero after capture.

- 2026-07-16: The top-bar speed control now cycles 1× → 4× → 10× → 1×. Faster playback changes only client request cadence; each backend request still advances exactly one simulated minute.

- 2026-07-16: User-provided Gemini keys now pass a small `models.get` request for the configured model before MediFlow marks them ready. Invalid or currently unusable keys remain outside session state. Session keys are used only for Gemini language requests; Staff reset always requires the dedicated reset credential.

- 2026-07-16: All visible application buttons now have observable behavior when available; unavailable completed-day playback actions are no longer rendered as disabled controls. Doctor actions preserve the deterministic scheduler boundary by navigating to patient guidance or selecting the next queued patient instead of pretending to start or skip clinical work client-side.

- 2026-07-15: Session Gemini fallback completed. A header key can generate and cache recommendation explanations and doctor briefs only when the Worker secret is absent; reload clears the browser-held key. All 19 backend tests and strict workspace checks pass.

- 2026-07-15: Production judge rehearsal completed from protected reset through all 30 patients at minute 240. MediFlow versus uncoordinated baseline: average wait 2 vs 10 minutes, visit duration 25 vs 32 minutes, utilization 46.5% vs 45%, average queue depth 0.3 vs 1.2, and peak queue depth 2 vs 5. The presenter script is in `docs/judge-walkthrough.md`, with five production captures in `artifacts/judge-walkthrough/`; the shared demo was returned to minute zero after capture.

- 2026-07-15: Gemini brief formatting deployed. Worker version `75f95ada-4442-4b0b-87d0-c60db31ca223` requests a six-line plain-text clinical summary and uses cache format version 2; the production Pages formatter also handles previously cached bold Markdown safely. Live patient `P-007` returned a Gemini brief with six expected categories and no raw Markdown syntax.

- 2026-07-15: Demo reset hardening deployed. Worker version `d5c6ddeb-f702-4062-a462-40ec2a8b808b` serves the protected reset route; the production Pages bundle contains the Staff reset dialog. Production smoke testing verified unauthorized rejection, atomic minute-zero restoration, one-minute playback, Gemini brief generation, and a final clean reset to 0 arrived / 0 completed patients.

- 2026-07-15: MVP completion audit passed. The complete-day test verifies 30/30 patient completion, all consultations and required services completed, and improvement over baseline in average wait, visit duration, utilization, average queue depth, and peak queue depth. The suite has 15 passing tests; strict checks and all production builds pass; the built frontend smoke test returns HTTP 200.

- 2026-07-15: Scheduling and live-data integration completed. The browser now renders persisted Worker/Turso state through a single polling context; it no longer computes recommendations or advances a separate in-memory simulation. `npm run check`, all nine backend tests, and all workspace production builds pass.

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
