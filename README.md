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
- `npm run build` creates production builds for every workspace.

To use Turso locally, copy `backend/.dev.vars.example` to
`backend/.dev.vars` and provide your database URL and authentication token.
The local secrets file is ignored by Git.
