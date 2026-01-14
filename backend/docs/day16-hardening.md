# Day 16 — Hardening

## Auth rate limits

Rate limiting is applied only to:

- `POST /api/auth/login`: **10 requests per 10 minutes** (per IP, and includes email when available)
- `POST /api/auth/refresh`: **30 requests per 10 minutes** (per IP)

When exceeded, the API returns **429** using the standard error envelope and includes `requestId`.

### Config (env)

- `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` (default `600000`)
- `AUTH_LOGIN_RATE_LIMIT_MAX` (default `10`)
- `AUTH_REFRESH_RATE_LIMIT_WINDOW_MS` (default `600000`)
- `AUTH_REFRESH_RATE_LIMIT_MAX` (default `30`)

## Security headers

The API uses `helmet` with a baseline configuration. CSP is disabled (`contentSecurityPolicy: false`) to avoid breaking Vite/React dev.

## Explicit CORS

CORS uses an explicit allowlist:

- Dev: `http://localhost:5173`
- Prod / overrides: `FRONTEND_ORIGIN` (supports a single origin or a comma-separated list)

Allowed methods: `GET, POST, PATCH, DELETE, OPTIONS`

Allowed headers: `Authorization, Content-Type, X-Request-Id`

Credentials are **disabled** (`credentials: false`) because refresh tokens are sent in the request body.

If you later move refresh tokens to `httpOnly` cookies, you will need `credentials: true` and to ensure the frontend uses `fetch(..., { credentials: 'include' })`.

## Proxy note

If running behind a reverse proxy (so `req.ip` should come from `X-Forwarded-For`), set:

- `TRUST_PROXY=true`
