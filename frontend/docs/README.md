# Frontend Docs

## Day 11 — App foundation (React + TypeScript + Vite)

This folder documents the Day 11 frontend foundation:
- Env-based API base URL
- Routing (public `/login`, protected app routes under layout)
- Access token storage (temporary Day 11 approach)

---

## Environment

### Required variable

Create `frontend/.env.local` (not committed) based on `frontend/.env.example`:

- `VITE_API_BASE_URL`
  - Example: `http://localhost:3000`
  - Used by the axios client in `frontend/src/api/client.ts`

Notes:
- If `VITE_API_BASE_URL` is not set, the app falls back to same-origin requests and prints a console warning.

---

## Routes

### Public

- `/login`
  - Login form (email/password)
  - If already authenticated (token present), it redirects to `/`

### Protected (requires token)

These routes are protected via `frontend/src/components/ProtectedRoute.tsx`.
If no token is present, they redirect to `/login`.

- `/` (Dashboard)
- `/users`
- `/roles`
- `/projects`
- `/audit-logs`

### Layout

Protected routes render inside the app shell layout (`frontend/src/components/Layout.tsx`):
- Sidebar navigation
- Topbar with title + Logout

Logout behavior (Day 11): clears token and navigates to `/login`.

---

## Token storage (Day 11)

Day 11 stores the access token in `localStorage` for simplicity.

- Storage key: `cr_rbac_access_token`
- Implementation: `frontend/src/auth/token.ts`

This is intentionally simple for Day 11. We will improve token handling later (Day 12+) and **do not** implement refresh-token flow yet.

---

## API endpoints used

- `POST /api/auth/login`
  - Expected shape: typically `{ data: { accessToken, refreshToken?, user? }, ... }`
  - Client parsing is defensive in `frontend/src/pages/Login.tsx`

- `GET /api/auth/me`
  - Called on Dashboard load to prove the token works
  - Displays `name` and `email` (also logs to console)

### Auth header

Axios attaches:

- `Authorization: Bearer <accessToken>`

via a request interceptor in `frontend/src/api/client.ts`.

### 401 handling

On HTTP `401`, the interceptor clears the token and redirects to `/login`.
