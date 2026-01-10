# Day 7: Polish API — Acceptance

Base URL (default): `http://localhost:4000`

All responses (success + error) should use the same envelope:

- Success: `{ ok: true, data, meta?, requestId }`
- Error: `{ ok: false, error: { code, message, details? }, requestId }`

Every response should also include the `X-Request-Id` header.

## Setup

1. Install deps

```bash
npm install
```

2. Start Postgres (if using docker-compose)

```bash
docker compose up -d
```

3. Run migrations + seed

```bash
npm run prisma:migrate
npx prisma db seed
```

4. Start API

```bash
npm run dev
```

Seeded credentials (from `prisma/seed.ts`):

- Admin: `admin@naxverse.local` / `Admin@12345`
- Read-only: `user@naxverse.local` / `User@12345`

## Success envelope checks

### 1) POST /api/auth/login

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@naxverse.local","password":"Admin@12345"}'
```

Expected:

- `200 OK`
- JSON body contains `ok: true` and a `requestId`
- Response headers include `X-Request-Id`

Capture token (bash):

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@naxverse.local","password":"Admin@12345"}' \
  | jq -r '.data.accessToken')
```

### 2) POST /api/auth/refresh

First capture refresh token:

```bash
REFRESH=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@naxverse.local","password":"Admin@12345"}' \
  | jq -r '.data.refreshToken')
```

Then:

```bash
curl -i -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"
```

Expected: `200 OK` + success envelope + `requestId`.

### 3) GET /api/users (list)

```bash
curl -i http://localhost:4000/api/users?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- `200 OK`
- JSON body: `{ ok: true, data: { users, page, limit, total, totalPages }, requestId }`

### 4) GET /api/roles (list)

```bash
curl -i http://localhost:4000/api/roles?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- `200 OK`
- JSON body includes `requestId` and list pagination fields.

### 5) GET /api/audit-logs (list)

```bash
curl -i "http://localhost:4000/api/audit-logs?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- `200 OK`
- JSON body includes `requestId`.

## Failure envelope checks

### 1) login missing email -> 400 VALIDATION_ERROR + details

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"Admin@12345"}'
```

Expected:

- `400 Bad Request`
- `{ ok: false, error: { code: "VALIDATION_ERROR", details: { issues, fieldErrors } }, requestId }`

### 2) invalid page=abc -> 400 VALIDATION_ERROR

```bash
curl -i "http://localhost:4000/api/users?page=abc" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `400` with `code=VALIDATION_ERROR`.

### 3) unknown route -> 404 NOT_FOUND

```bash
curl -i http://localhost:4000/api/this-route-does-not-exist
```

Expected: `404` with `code=NOT_FOUND` and a `requestId`.

### 4) duplicate email -> 409 CONFLICT

```bash
curl -i -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@naxverse.local","password":"Admin@12345"}'
```

Expected: `409` with `code=CONFLICT`.

### 5) forced internal error -> 500 INTERNAL (no stack trace)

One easy way is to stop Postgres (or point `DATABASE_URL` to a bad value), then call any DB-backed endpoint:

```bash
curl -i http://localhost:4000/api/users \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- `500`
- `{ ok: false, error: { code: "INTERNAL", message: "Internal server error" }, requestId }`
- No stack trace in the response body
