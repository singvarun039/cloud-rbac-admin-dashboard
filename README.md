# Cloud RBAC Admin Dashboard

Monorepo:
- `backend/` — Node.js + Express API (Prisma + Postgres)
- `frontend/` — React (Vite)

This repo includes a Docker Compose dev setup that runs:
- Postgres (`db`)
- API (`api`) with hot reload
- Web (`web`) with hot reload

Dockerfiles live next to the real sources:
- `backend/Dockerfile`
- `frontend/Dockerfile`

## Architecture

- **Frontend**: React + Vite. In dev, the Vite server proxies `/api` → API.
- **API**: Express + Prisma. Prisma connects to Postgres.
- **Docker dev**: `docker compose` runs `db`, `api`, `web` with bind mounts for hot reload.

## Prerequisites

- Docker Desktop (Docker Compose v2)

## Run (Dev)

1) Create a `.env` from the example:

- Copy `.env.example` → `.env`

2) Start everything:

- Preferred (deterministic):
	- `docker compose up -d --build --wait`

- If your Docker Compose doesn't support `--wait`:
	- `docker compose up -d --build`
	- `docker compose ps`
	- Retry curls until `api` is Up and (if shown) Healthy

3) Initialize the database (first run / after `down -v`):

	- `docker compose exec api npm run db:init`

	Seeded credentials (dev):
	- `rbac_admin@rbac.local` / `rbac@1234`

## Verify (Dev)

### Endpoints

- `curl http://localhost:4000/api/health`
- `curl http://localhost:5173/api/health`

### Login (API)

- `curl -i -sS -X POST http://localhost:4000/api/auth/login \
	-H "Content-Type: application/json" \
	-d '{"email":"rbac_admin@rbac.local","password":"rbac@1234"}'`

### Hot reload (Windows)

File watching over bind mounts can be flaky on Windows. Polling is supported but **disabled by default**.

1) Start with polling enabled:

	- `CHOKIDAR_USEPOLLING=true docker compose up -d --build --wait`

	- (Alternative) `WATCHPACK_POLLING=true docker compose up -d --build --wait`

2) In another terminal, touch files on the host (this is the real signal path we care about):

	- API reload: `touch backend/src/routes/health.ts` then `docker compose logs -f --tail=50 api`
	- Web reload: `touch frontend/src/App.tsx` then `docker compose logs -f --tail=50 web`

If you need observable Vite HMR debug output in logs (without adding custom app logging), run:

	- `CHOKIDAR_USEPOLLING=true DEBUG=vite:hmr docker compose up -d --build --wait`

## Stop

- `docker compose down`

## Reset DB

This removes the Postgres volume (data loss):

- `docker compose down -v`

## URLs

- Web: http://localhost:${WEB_PORT:-5173}
- API: http://localhost:${API_PORT:-4000}

## DB access (local dev)

Postgres is **not** an HTTP service, so opening `http://localhost:5432` in a browser will fail.

Connect using `psql` or a GUI (pgAdmin/DBeaver) with:
- Host: `localhost`
- Port: `5432`
- Database: `POSTGRES_DB` (default `crbad`)
- User: `POSTGRES_USER` (default `postgres`)
- Password: `POSTGRES_PASSWORD` (default `postgres`)

## Troubleshooting

- **Port conflicts**: change `API_PORT`, `WEB_PORT`, or the `5432:5432` mapping in `docker-compose.yml`.
- **Login returns `DB_NOT_READY`**: run `docker compose exec api npm run db:init`.
- **Windows file watching**: if hot reload doesn’t trigger on bind mounts, rerun with polling:
	- `CHOKIDAR_USEPOLLING=true docker compose up -d --build --wait`
- **Rebuild images**: `docker compose build --no-cache` then `docker compose up`.

## Production images

- Web production stage uses **nginx** to serve the Vite `dist/` folder (see `frontend/Dockerfile` + `frontend/nginx.conf`).
