# MediFlow

MediFlow is an AI Hospital Resource Orchestrator that helps hospitals coordinate patient flow across existing resources.

## Workspaces

- `frontend/` - React and Vite staff, doctor, and patient views
- `backend/` - Hono API targeting Cloudflare Workers
- `shared/` - domain types and API contracts used by both applications

## Running the code

Use Node.js 20.19 or newer and install dependencies with `npm ci`.

- `npm run dev` starts the frontend development server.
- `npm run dev:api` starts the local Cloudflare Worker.
- `npm run check` type-checks every workspace.
- `npm test` runs workspace tests, including migration and deterministic-seed integration coverage.
- `npm run build` creates production builds for every workspace.

To use Turso locally, copy `backend/.dev.vars.example` to
`backend/.dev.vars` and provide your database URL and authentication token.
The local secrets file is ignored by Git.

## Database development

- `npm run db:generate --workspace @mediflow/backend` generates a committed SQLite migration from `backend/src/db/schema.ts`. This command does not connect to Turso.
- `npm run db:seed --workspace @mediflow/backend` applies pending migrations to the configured Turso database, clears existing simulated operational data, and loads the canonical deterministic fixture (6 resources and 30 patients). Use it only when resetting the simulation database is intended.

Migration and seed execution are development commands. The Cloudflare Worker never runs them during a request.

## Simulation API

- `GET /api/simulation` returns the persistent simulation minute, playback settings, seed, and patient counts.
- `POST /api/simulation/tick` advances exactly one simulated minute and returns the clock, arrival, and service-completion events created by that tick.

Each tick is atomic and deterministic. Playback speed is implemented by how frequently the client requests ticks; the API never skips intermediate minutes or starts background work.
