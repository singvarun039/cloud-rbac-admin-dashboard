# Progress Log

## Day 5 — RBAC enforcement middleware

- Added `authenticate` middleware that verifies `Authorization: Bearer <accessToken>`, loads the user from DB, rejects inactive users, derives effective permissions from roles, and attaches `req.user` with `permissions: string[]`.
- Added `requirePermission(permissionKey)` middleware for per-route authorization checks.
- Protected endpoints (proof of enforcement):
  - `GET /api/users` requires `users.read`
  - `POST /api/users` requires `users.write`
  - `GET /api/roles` requires `roles.read`
- Updated `GET /api/auth/me` to return `{ user, permissions }` where `permissions` are effective permissions.
- Added `requests.http` with acceptance checks.

### Acceptance checks (manual)

Run seed + server:

- `npx prisma migrate dev`
- `npx prisma db seed`
- `npm run dev`

Then execute the requests in `requests.http`.

Expected results:

- `/api/users` without token -> **401**
- `/api/users` with invalid token -> **401**
- `/api/users` with ADMIN token -> **200**
- `/api/users` with USER token -> **403**
- `/api/auth/me` returns `permissions: string[]` -> **200**
