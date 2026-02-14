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

## Prerequisites

- Docker Desktop (Docker Compose v2)

## Run (Dev)

1) Create a `.env` from the example:

- Copy `.env.example` → `.env`

2) Start everything:

- `docker compose up --build`

## Stop

- `docker compose down`

## Reset DB

This removes the Postgres volume (data loss):

- `docker compose down -v`

## URLs

- Web: http://localhost:${WEB_PORT:-5173}
- API: http://localhost:${API_PORT:-4000}

## Troubleshooting

- **Port conflicts**: change `API_PORT`, `WEB_PORT`, or the `5432:5432` mapping in `docker-compose.yml`.
- **Windows file watching**: if hot reload is flaky, run Docker Desktop with WSL2 and keep the repo in the Linux filesystem. You can also set `CHOKIDAR_USEPOLLING=true` (supported by both `api` and `web` services).
- **Rebuild images**: `docker compose build --no-cache` then `docker compose up`.

## Production images

- Web production stage uses **nginx** to serve the Vite `dist/` folder (see `frontend/Dockerfile` + `frontend/nginx.conf`).
