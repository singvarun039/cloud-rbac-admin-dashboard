# Cloud RBAC Admin Dashboard

A full-stack Role-Based Access Control (RBAC) admin dashboard. Users, roles, and permissions are fully manageable through a React UI backed by a Node.js/TypeScript API and PostgreSQL — deployable on Render (Web Service + Static Site + managed Postgres) or AWS EC2 + RDS via Terraform.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Terraform](https://img.shields.io/badge/Terraform-AWS-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![AWS](https://img.shields.io/badge/AWS-EC2%20%7C%20RDS-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/)

**Live demo:** [YOUR_RENDER_FRONTEND_URL](https://YOUR_RENDER_FRONTEND_URL) — see [Demo credentials](#demo-credentials) below.

---

## Features

1. **Database-driven RBAC** with 3 roles (Admin, Editor, Viewer) and flat, composable permission keys (e.g. `users.read`, `projects.write`) — no hardcoded role checks in route handlers.
2. **JWT access/refresh token rotation** with server-side logout — refresh tokens are stored only as hashes, rotated on every use, and revoked immediately on logout (see [Auth Flow](#auth-flow)).
3. **3 independently tuned rate limiters** — login (IP+email keyed), refresh (IP keyed), and AI routes — each with its own window/max via env vars.
4. **28 REST endpoints** across auth, users, roles, permissions, projects, audit logs, dashboard, and AI, backed by **8 relational tables** (`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Session`, `AuditLog`, `Project`).
5. **AI governance layer** — RBAC assistant, audit anomaly insights, role-permission recommendations, and pre-save policy simulation, each with visible data-source attribution and its own audit trail (`writeAiUsageAuditLog`).
6. **57 automated tests** — 21 backend (Node test runner, incl. Supertest integration coverage) + 27 Vitest/RTL unit & component tests + 9 Playwright E2E specs across Admin/Editor/Viewer roles. See [Testing](#testing).
7. **13 AWS resources provisioned via Terraform** — VPC, 2 public subnets, internet gateway, route table + associations, 2 security groups, EC2 instance, and an RDS Postgres instance. See [`infra/terraform`](infra/terraform/README.md).

---

## Monorepo layout

- `backend/` — Node.js + Express API (TypeScript, Prisma + PostgreSQL)
- `frontend/` — React + Vite SPA (TypeScript, Tailwind CSS)
- `infra/terraform/` — AWS EC2 + RDS provisioning via Terraform
- `render.yaml` — Render Blueprint (Web Service + Static Site + managed Postgres)
- `TESTING.md` — test folder layout, run commands, and current coverage matrix

---

## Architecture

### System Diagram

```
                        ┌──────────────┐
                        │   Browser    │
                        └──────┬───────┘
                               │ HTTPS
                               ▼
              ┌────────────────────────────────┐
              │   Static Site (Render / nginx)  │
              │       React SPA (dist/)         │
              └────────────────┬─────────────────┘
                               │ VITE_API_BASE_URL
                               ▼
              ┌────────────────────────────────┐
              │   Web Service (Render / EC2)     │
              │   Express API (port 4000/$PORT)  │
              │                                  │
              │  auth · users · roles            │
              │  permissions · projects           │
              │  audit logs · dashboard · ai      │
              │                                  │
              │  Pino JSON → stdout              │
              │  Helmet security headers          │
              │  Rate limiting (express-          │
              │    rate-limit)                    │
              └────────────────┬─────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  Managed PostgreSQL              │
              │  (Render Postgres / AWS RDS 16)  │
              └────────────────────────────────┘
```

### Key Components

| Layer    | Technology                                       | Notes                                                          |
| -------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Frontend | React + Vite + Tailwind CSS + shadcn/ui          | SPA, React Router, responsive UI, env-driven API base URL      |
| API      | Node.js + Express + TypeScript                   | Pino structured JSON logs, Helmet, rate limiting, CORS         |
| ORM      | Prisma + PostgreSQL (driver adapter: `@prisma/adapter-pg`) | Typed schema, incremental migrations             |
| Auth     | JWT access tokens + bcrypt-hashed refresh tokens | Token rotation on every refresh, DB-backed sessions            |
| Infra    | Render Blueprint (`render.yaml`) or Terraform + AWS EC2/RDS | One-click Render deploy, or `terraform apply` for AWS |
| Proxy    | nginx (Docker/EC2 path only)                     | Serves compiled SPA, reverse proxies `/api/*` to API container |

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
| **No CI/CD pipeline**                     | Deploys are triggered by `terraform apply` (AWS) or a Render Blueprint sync (Render). GitHub Actions is a natural next step.                                        |

---

## Getting started locally

### Prerequisites

- Node.js 20+, npm
- A local PostgreSQL instance (or Docker Desktop — see [Docker section](#docker-alternative) below)

### Setup

```bash
git clone <this-repo>
cd cloud-rbac-admin-dashboard

# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL and JWT secrets for local dev
npm install
npm run prisma:migrate      # applies migrations to your local DB
npm run seed                # seeds Admin/Editor/Viewer demo users + demo projects
npm run dev                 # http://localhost:4000

# Frontend (separate terminal)
cd frontend
cp .env.example .env.local  # set VITE_API_BASE_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:5173
```

### Docker alternative

```bash
cp .env.example .env
docker compose up -d --build --wait
docker compose exec api npm run db:init   # migrate + seed, first run only
```

- Web: http://localhost:${WEB_PORT:-5173}
- API: http://localhost:${API_PORT:-4000}

---

## Demo credentials

Seeded by `npm run seed` / `docker compose exec api npm run db:init` (idempotent — safe to re-run):

| Role   | Email                    | Password    |
| ------ | ------------------------ | ----------- |
| Admin  | `rbac_admin@rbac.local`  | `rbac@1234` |
| Editor | `rbac_editor@rbac.local` | `rbac@1234` |
| Viewer | `rbac_viewer@rbac.local` | `rbac@1234` |

To use recruiter-friendly credentials instead (e.g. on a hosted demo), override before seeding:

```bash
SEED_ADMIN_EMAIL=admin@demo.com SEED_ADMIN_PASSWORD=Admin@1234 npm run seed
```

---

## Project structure

```
cloud-rbac-admin-dashboard/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # 8 models: User, Role, Permission, UserRole,
│   │   │                       # RolePermission, Session, AuditLog, Project
│   │   ├── migrations/
│   │   └── seed.ts             # idempotent demo data (bcrypt-hashed passwords)
│   ├── src/
│   │   ├── modules/            # auth, users, roles, permissions, projects,
│   │   │                       # auditLogs, dashboard, ai (route + controller per module)
│   │   ├── middlewares/        # authenticate, requirePermission, validate, errorHandler...
│   │   ├── services/           # dashboardSummary, aiGovernance, auditInsights...
│   │   ├── config/env.ts       # env validation (fails fast on missing prod secrets)
│   │   ├── db/prisma.ts        # PrismaClient via @prisma/adapter-pg + pg.Pool
│   │   ├── app.ts              # Express app factory (CORS, Helmet, routes)
│   │   └── index.ts            # entry point — reads PORT, starts the server
│   └── test/                   # Unit, Integration, RBAC contract, Error envelope
├── frontend/
│   ├── src/
│   │   ├── api/client.ts       # axios instance, VITE_API_BASE_URL, refresh interceptor
│   │   ├── auth/                # token storage, auth context
│   │   ├── pages/, components/, routes/, hooks/
│   ├── test/                   # Unit, Component, E2E (Playwright)
│   └── vite.config.ts
├── infra/terraform/            # AWS VPC, EC2, RDS, security groups
├── render.yaml                 # Render Blueprint: backend + frontend + Postgres
└── TESTING.md
```

---

## API overview

All routes are mounted under `/api`. Every protected route requires `Authorization: Bearer <accessToken>` and the listed permission(s).

| Group           | Base path            | Endpoints                                                                 | Permission(s)                    |
| --------------- | --------------------- | -------------------------------------------------------------------------- | --------------------------------- |
| Health          | `/api/health`          | `GET /`                                                                    | none (public)                     |
| Auth            | `/api/auth`             | `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`                  | none / bearer token for `/me`     |
| Users           | `/api/users`            | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `DELETE /:id/permanent`    | `users.read` / `.write` / `.edit` |
| Roles           | `/api/roles`            | `GET /`, `POST /`, `PATCH /:id`, `POST /assign`, `POST /:id/permissions`, `PUT /:roleId/permissions`, `DELETE /:id/permanent` | `roles.read` / `.write` / `.edit` |
| Permissions     | `/api/permissions`      | `GET /`                                                                    | `permissions.read`                |
| Projects        | `/api/projects`         | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`                             | `projects.read` / `.write` / `.edit` |
| Audit Logs      | `/api/audit-logs`       | `GET /` (filterable by actor, action, entity, date range)                  | `audit.read`                      |
| Dashboard       | `/api/dashboard`        | `GET /summary`                                                             | any of users/roles/projects/audit read |
| AI              | `/api/ai`                | `POST /assistant`, `GET /audit-insights`, `GET /role-recommendations`, `POST /policy-simulation` | varies per route + AI rate limiter |

---

## Testing

See [`TESTING.md`](TESTING.md) for the full coverage matrix and folder layout. Summary:

| Suite                          | Count | Command                              |
| ------------------------------- | :---: | ------------------------------------- |
| Backend (Node test runner + Supertest) | 21   | `cd backend && npm test`             |
| Frontend unit + component (Vitest/RTL) | 27   | `cd frontend && npm test`            |
| Frontend E2E (Playwright)              | 9    | `cd frontend && npm run test:e2e`    |

Backend breakdown: 12 Integration (Supertest — auth flow, security headers/CORS/rate limiting), 6 Unit (password/JWT helpers, error/date-window utils), 1 RBAC contract (permission flattening), 2 Error envelope (response shape).

---

## Deploying to Render

This repo includes a `render.yaml` Blueprint that provisions all three services in one go:

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, point it at the repo — Render reads `render.yaml` and creates the backend Web Service, frontend Static Site, and a managed Postgres database.
3. Fill in the env vars marked `sync: false` in the Render dashboard (see below) before the first deploy succeeds.
4. After the backend deploys, note its public URL and set it as `VITE_API_BASE_URL` on the frontend service, then redeploy the frontend (Vite bakes env vars in at build time).
5. Run the seed command once via the backend's Render Shell: `npm run seed` (optionally prefixed with `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=...` for custom demo credentials).

Env vars you must set manually (`sync: false` in `render.yaml`):

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REFRESH_TOKEN_HASH_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
- `FRONTEND_ORIGIN` (backend) — the deployed frontend URL, e.g. `https://rbac-dashboard-frontend.onrender.com`
- `VITE_API_BASE_URL` (frontend) — the deployed backend URL, e.g. `https://rbac-dashboard-backend.onrender.com`
- `OPENAI_API_KEY` (backend, optional) — only needed for the AI routes

## Deploying to AWS (Terraform)

See [`infra/terraform/README.md`](infra/terraform/README.md) for the full Terraform deployment guide (EC2 + RDS, 13 resources).

---

## Troubleshooting

- **Port conflicts (Docker/local)**: change `API_PORT`, `WEB_PORT`, or the `5432:5432` mapping in `docker-compose.yml`.
- **Login returns `DB_NOT_READY`**: run `docker compose exec api npm run db:init` (or `npm run prisma:migrate && npm run seed` outside Docker).
- **Windows file watching**: if hot reload doesn't trigger on bind mounts, rerun with `CHOKIDAR_USEPOLLING=true docker compose up -d --build --wait`.
- **CORS errors in production**: confirm `FRONTEND_ORIGIN` on the backend exactly matches the frontend's deployed origin (scheme + host, no trailing slash).
- **Frontend calling `localhost` in production**: `VITE_API_BASE_URL` wasn't set before the static site was built — set it and trigger a rebuild (Vite env vars are compile-time, not runtime).

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
