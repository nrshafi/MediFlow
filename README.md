# MediFlow

MediFlow is a deterministic hospital resource orchestrator for a simulated 30-patient day. It routes patients across three doctors, a laboratory, X-ray, and ECG; predicts queues and congestion; explains already-made scheduling decisions with Gemini; prepares pre-consultation record briefs; and compares live performance with a fixed-order FIFO baseline.

The LLM is language-only. Scheduling, priority, doctor balancing, queue ordering, and metrics remain deterministic when Gemini is unavailable.

## Workspaces

- `frontend/` — React 19 + Vite staff dashboard, patient guidance, and doctor brief views
- `backend/` — Hono API and deterministic engine targeting Cloudflare Workers
- `shared/` — strict TypeScript domain types and API contracts

## Local setup

Requirements: Node.js 20.19 or newer, npm 11, and a Turso database.

1. Install dependencies with `npm ci`.
2. Copy `backend/.dev.vars.example` to `backend/.dev.vars`.
3. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in that file.
4. Set `GEMINI_API_KEY` to enable Gemini explanations and summaries. Without it, scheduling works unchanged and the UI uses explicit deterministic text fallbacks.
   You can also add a session-only fallback key from the key button in the application header. The Worker secret takes precedence; the fallback key remains only in React memory and clears on reload.
5. Apply migrations and load the reproducible fixture:

   ```powershell
   npm run db:seed --workspace @mediflow/backend
   ```

6. In separate terminals, start the Worker and frontend:

   ```powershell
   npm run dev:api
   npm run dev
   ```

Vite proxies `/api` to `http://127.0.0.1:8787`. The frontend opens on `http://127.0.0.1:5173`.

## Commands

- `npm run check` — strict TypeScript checks for every workspace
- `npm test` — pure engine, migration/seed, API, Gemini adapter, and complete simulated-day tests
- `npm run build` — Vite production bundle plus a Wrangler Worker dry run
- `npm run db:generate --workspace @mediflow/backend` — generate a new committed migration after schema changes
- `npm run db:seed --workspace @mediflow/backend` — apply pending migrations and intentionally reset the simulation fixture

The Worker never runs migrations or seed/reset operations during a request.

## API

- `GET /api/health` — service health
- `GET /api/simulation` — persistent clock and patient counts
- `POST /api/simulation/tick` — atomically advance exactly one simulated minute
- `POST /api/simulation/reset` — restore the canonical minute-zero fixture; disabled unless `DEMO_RESET_TOKEN` is configured and protected by a bearer credential
- `GET /api/operations` — shared polling snapshot for all three frontend views
- `GET /api/patients/:patientId/brief` — cached Gemini pre-consultation summary or deterministic fallback

Requests to the tick and doctor-brief endpoints may include `X-Gemini-Api-Key` as a session-only fallback when the Worker has no `GEMINI_API_KEY`. The header value is bounded and validated, is never logged or persisted, and is ignored whenever the configured Worker secret is available.

Every tick completes due work, registers arrivals, applies urgent-before-normal queues without preemption, balances interchangeable simulated consultations, starts idle resources, records recommendations and metrics, and persists one ordered audit trail.

## Deployment

Deploy the backend as a Cloudflare Worker and configure these secrets/variables:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional; defaults to `gemini-3.1-flash-lite`)
- `DEMO_RESET_TOKEN` (optional; enables the protected Staff-view demo reset)

Set the reset credential as a Worker secret rather than a plain Wrangler variable:

```powershell
npx wrangler secret put DEMO_RESET_TOKEN --config backend/wrangler.jsonc
```

The Staff view asks for this credential at reset time. It is sent only in that request and is not bundled into the frontend or persisted in browser storage.

The Gemini key button similarly accepts an optional session fallback for demos where the Worker secret is unavailable. It is held only in page memory, sent only on Gemini-capable requests, and cleared by a reload or tab close.

Build `frontend/` for Cloudflare Pages. If Pages and the Worker do not share an origin, set `VITE_API_BASE_URL` to the deployed Worker origin before building. The MVP API permits cross-origin GET/POST access because it serves simulated data only; introduce real authentication and a restricted origin policy before using any real hospital data.

## Deterministic baseline

The baseline uses the identical fixture and naive FIFO queues with a fixed `lab → X-ray → ECG → consultation` sequence, skipping services a patient does not require. The complete-day acceptance test proves all 30 patients and all required consultations finish and verifies improvement in average wait, visit duration, resource utilization, average queue depth, and peak queue depth.
