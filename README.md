# Cloud RBAC Admin Dashboard

A full-stack Role-Based Access Control (RBAC) admin dashboard. Users, roles, and permissions are fully manageable through a React UI backed by a Node.js/TypeScript API and PostgreSQL — deployed on AWS EC2 + RDS via Terraform.

## AI

This project now includes a first AI integration:

- dashboard-level RBAC assistant for authenticated users
- dashboard-level audit anomaly insights for users with `audit.read`
- roles-page AI recommendations grounded in the current role matrix
- pre-save policy simulation for role permission changes
- AI usage audit logging, route rate limits, and visible data-source attribution
- backend OpenAI Responses API route at `/api/ai/assistant`
- backend OpenAI Responses API route at `/api/ai/audit-insights`
- backend OpenAI Responses API route at `/api/ai/role-recommendations`
- backend OpenAI Responses API route at `/api/ai/policy-simulation`
- environment-based configuration with `OPENAI_API_KEY` and `OPENAI_MODEL`

Setup:

- copy `.env.example` values into your local `.env`
- set `OPENAI_API_KEY`
- optionally change `OPENAI_MODEL` from the default `gpt-5-nano`

Roadmap:

- see `AI_ROADMAP.md` for the phased plan

Monorepo:

- `backend/` — Node.js + Express API (Prisma + PostgreSQL)
- `frontend/` — React + Vite SPA
- `infra/terraform/` — AWS EC2 + RDS provisioning via Terraform
- `TESTING.md` — test folder layout, run commands, and current coverage matrix

---

## Architecture

### System Diagram

```
                        ┌──────────────┐
                        │   Browser    │
                        └──────┬───────┘
                               │ HTTP :80
                               ▼
              ┌────────────────────────────────┐
              │          EC2 Instance           │
              │                                 │
              │  ┌──────────────────────────┐   │
              │  │     nginx  (port 80)     │   │
              │  │                          │   │
              │  │  GET /       → SPA dist  │   │
              │  │  /api/*      → api:4000  │   │
              │  └────────────┬─────────────┘   │
              │               │ Docker network   │
              │  ┌────────────▼─────────────┐   │
              │  │   Express API (port 4000) │   │
              │  │                           │   │
              │  │  auth · users · roles     │   │
              │  │  permissions · projects   │   │
              │  │  audit logs               │   │
              │  │                           │   │
              │  │  Pino JSON → stdout       │   │
              │  │  Helmet security headers  │   │
              │  │  Rate limiting (express-  │   │
              │  │    rate-limit)            │   │
              │  └────────────┬──────────────┘  │
              └───────────────┼─────────────────┘
                              │ VPC private link
                              │ SG: EC2 → port 5432 only
                              ▼
              ┌────────────────────────────────┐
              │  AWS RDS PostgreSQL 16          │
              │  (publicly_accessible = false)  │
              └────────────────────────────────┘
```

### Key Components

| Layer    | Technology                                       | Notes                                                          |
| -------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Frontend | React + Vite + Tailwind CSS + shadcn/ui          | SPA, React Router, responsive UI, same-origin API via nginx    |
| API      | Node.js + Express + TypeScript                   | Pino structured JSON logs, Helmet, rate limiting, CORS         |
| ORM      | Prisma + PostgreSQL                              | Typed schema, incremental migrations                           |
| Auth     | JWT access tokens + bcrypt-hashed refresh tokens | Token rotation on every refresh, DB-backed sessions            |
| Infra    | Terraform + AWS EC2 + RDS                        | One `terraform apply` bootstraps the full stack                |
| Proxy    | nginx                                            | Serves compiled SPA, reverse proxies `/api/*` to API container |

---

## Auth Flow

```
POST /api/auth/login
  ← { email, password }
  → verify password (bcrypt compare)
  → issue access token  (JWT, signed, 15 min TTL)
  → issue refresh token (random bytes, stored as bcrypt hash in sessions table)
  → return { accessToken, refreshToken }

Every authenticated request:
  Authorization: Bearer <accessToken>
  → middleware verifies JWT signature + expiry  (no DB hit)
  → req.user = { id, email, roles, permissions }
  → requirePermission("resource.action") middleware checks permission set

POST /api/auth/refresh
  ← { refreshToken }
  → look up session by hashed token
  → verify token not expired / not revoked
  → create new session  (new access + refresh token pair)
  → set old session.replacedBySessionId = new session ID  (rotation trail)
  → return { accessToken, refreshToken }

POST /api/auth/logout
  → set session.revokedAt = now()
  → client discards both tokens
```

**Security properties:**

- Access tokens are stateless — fast verification, no DB hit per request
- Short 15-minute TTL limits the window if an access token is leaked
- Refresh tokens are stored only as bcrypt hashes — plaintext never persists in the DB
- Each refresh rotates the token — reuse of an already-rotated token is detectable
- Logout is server-side — session is revoked immediately in the DB

---

## RBAC Model

```
User ──< UserRole >── Role ──< RolePermission >── Permission
```

Permissions are flat string keys (e.g. `users.read`, `projects.write`). The API middleware checks `req.user.permissions` — a set derived from all roles the user holds.

**Built-in role matrix:**

| Permission         | ADMIN | EDITOR | VIEWER |
| ------------------ | :---: | :----: | :----: |
| `users.read`       |  ✅   |   ✅   |   ✅   |
| `users.write`      |  ✅   |   ❌   |   ❌   |
| `users.edit`       |  ✅   |   ✅   |   ❌   |
| `roles.read`       |  ✅   |   ✅   |   ✅   |
| `roles.write`      |  ✅   |   ❌   |   ❌   |
| `roles.edit`       |  ✅   |   ❌   |   ❌   |
| `permissions.read` |  ✅   |   ✅   |   ✅   |
| `projects.read`    |  ✅   |   ✅   |   ✅   |
| `projects.write`   |  ✅   |   ❌   |   ❌   |
| `projects.edit`    |  ✅   |   ✅   |   ❌   |
| `audit.read`       |  ✅   |   ✅   |   ✅   |

A user can hold multiple roles; permissions are the union of all assigned roles.

---

## Trade-offs

| Decision                                  | Trade-off                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flat permissions** (not hierarchical)   | Simple to reason about, easy to audit. No wildcard inheritance complexity. Scales to hundreds of keys before needing a tree model.                                  |
| **DB-backed sessions** + short-lived JWTs | Enables server-side revocation (logout works immediately). Cost: one DB read per `/refresh`. Pure stateless JWTs would remove that cost but make logout unreliable. |
| **Access token not revocable mid-life**   | Stateless verification = zero DB hit per API call. Mitigated by 15-minute TTL — worst case a leaked token expires quickly.                                          |
| **Refresh token rotation** on every use   | Stolen token reuse is detectable via `replacedBySessionId` chain. Extra complexity vs a simple sliding expiry window.                                               |
| **Single EC2 + single RDS, no HA**        | Right-sized for a portfolio project. The path to production HA is: EC2 → ASG behind ALB, RDS → Multi-AZ, with minimal Terraform changes.                            |
| **No CI/CD pipeline**                     | `terraform apply` + userdata bootstraps the full stack automatically on EC2 start. GitHub Actions pipeline is a natural next step.                                  |

---

## Prerequisites

- Docker Desktop (Docker Compose v2)

## Run (Dev)

1. Create a `.env` from the example:

- Copy `.env.example` → `.env`

2. Start everything:

- Preferred (deterministic):
  - `docker compose up -d --build --wait`

- If your Docker Compose doesn't support `--wait`:
  - `docker compose up -d --build`
  - `docker compose ps`
  - Retry curls until `api` is Up and (if shown) Healthy

3. Initialize the database (first run / after `down -v`):
   - `docker compose exec api npm run db:init`

   This runs migrations and seeds initial data for local development.

## Verify (Dev)

### Endpoints

- `curl http://localhost:4000/api/health`
- `curl http://localhost:5173/api/health`

### Login (API)

- `curl -i -sS -X POST http://localhost:4000/api/auth/login \
-H "Content-Type: application/json" \
-d '{"email":"rbac_admin@rbac.local","password":"rbac@1234"}'`

### Demo credentials (seeded)

| Role   | Email                    | Password    |
| ------ | ------------------------ | ----------- |
| Admin  | `rbac_admin@rbac.local`  | `rbac@1234` |
| Editor | `rbac_editor@rbac.local` | `rbac@1234` |
| Viewer | `rbac_viewer@rbac.local` | `rbac@1234` |

### Hot reload (Windows)

File watching over bind mounts can be flaky on Windows. Polling is supported but **disabled by default**.

1. Start with polling enabled:
   - `CHOKIDAR_USEPOLLING=true docker compose up -d --build --wait`

   - (Alternative) `WATCHPACK_POLLING=true docker compose up -d --build --wait`

2. In another terminal, touch files on the host (this is the real signal path we care about):
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
- **Windows file watching**: if hot reload doesn't trigger on bind mounts, rerun with polling:
  - `CHOKIDAR_USEPOLLING=true docker compose up -d --build --wait`
- **Rebuild images**: `docker compose build --no-cache` then `docker compose up`.

## Production images

- Web production stage uses **nginx** to serve the Vite `dist/` folder (see `frontend/Dockerfile` + `frontend/nginx.conf`).

## AWS deploy (Terraform)

See `infra/terraform/README.md` for the full Terraform deployment guide.

---

## Code formatting

Each workspace has its own Prettier config and `format` script. Run from the relevant folder:

```bash
# Frontend
cd frontend
npm run format        # write
npm run format:check  # check only

# Backend
cd backend
npm run format        # write
npm run format:check  # check only
```

Config lives in `frontend/.prettierrc` and `backend/.prettierrc`. Ignore rules are in the matching `.prettierignore` files.
