# Testing Matrix

This repo uses a layered test structure so it is easy to see what is covered and where new tests should go.

## Folder layout

### Backend

- `backend/test/Unit`
- `backend/test/Integration`
- `backend/test/RBAC contract`
- `backend/test/Error envelope`

### Frontend

- `frontend/test/Unit`
- `frontend/test/Component`
- `frontend/test/E2E`

## Run commands

### Backend

```bash
cd backend
npm test
```

### Frontend unit/component tests

```bash
cd frontend
npm test
```

### Frontend E2E tests

```bash
cd frontend
npm run test:e2e
```

## Current backend coverage

| Layer | File | What it covers |
| --- | --- | --- |
| Unit | `backend/test/Unit/appError-dateWindow.test.ts` | `AppError` factories and UTC date window helpers |
| Unit | `backend/test/Unit/auth-utils.test.ts` | password hashing, access/refresh JWT helpers, refresh-token hashing |
| Integration | `backend/test/Integration/hardening.test.ts` | security headers, CORS, rate limiting, permission middleware behavior |
| Integration | `backend/test/Integration/auth-flow.test.ts` | route-level auth flow for `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` |
| RBAC contract | `backend/test/RBAC contract/rbac-utils.test.ts` | effective permission flattening and deduplication |
| Error envelope | `backend/test/Error envelope/apiResponse.test.ts` | success/error API response envelope shape |

## Current frontend unit/component coverage

| Layer | File | What it covers |
| --- | --- | --- |
| Unit | `frontend/test/Unit/api.test.ts` | `unwrapData` envelope helper |
| Unit | `frontend/test/Unit/authHelpers.test.ts` | auth payload parsing and normalization |
| Unit | `frontend/test/Unit/tokenStore.test.ts` | token persistence and logout/refresh callbacks |
| Unit | `frontend/test/Unit/dashboardUtils.test.ts` | dashboard insight parsing |
| Unit | `frontend/test/Unit/errors.test.ts` | canceled/conflict error detection helpers |
| Unit | `frontend/test/Unit/format.test.ts` | date and label formatting helpers |
| Unit | `frontend/test/Unit/pagination.test.ts` | pagination item builder |
| Unit | `frontend/test/Unit/useAssignPermissions.test.tsx` | permission assignment hook behavior: hydrate, toggle, simulate, save, error handling |
| Error envelope | `frontend/test/Error envelope/client.test.ts` | frontend API error message extraction |
| Component | `frontend/test/Component/Login.test.tsx` | login validation, success flow, server error display |
| Component | `frontend/test/Component/PermissionCatalog.test.tsx` | permission catalog rendering and action callbacks |

## Current frontend E2E coverage

| Role / theme | File | What it covers |
| --- | --- | --- |
| Admin | `frontend/test/E2E/login-admin-flow.spec.ts` | login to dashboard shell |
| Admin | `frontend/test/E2E/logout-flow.spec.ts` | logout from the user menu |
| Admin | `frontend/test/E2E/invalid-login.spec.ts` | invalid login error flow |
| Admin | `frontend/test/E2E/roles-permission-flow.spec.ts` | roles page permission assignment flow with simulation and save |
| Admin | `frontend/test/E2E/users-filter-view-flow.spec.ts` | users page filter + detail sheet flow |
| Admin | `frontend/test/E2E/projects-page.spec.ts` | projects page listing flow |
| Editor | `frontend/test/E2E/editor-roles-read-only.spec.ts` | roles page read-only behavior for editor |
| Viewer | `frontend/test/E2E/viewer-access-limited.spec.ts` | blocked route / forbidden experience |
| Viewer | `frontend/test/E2E/viewer-users-read-only.spec.ts` | users page read-only behavior for viewer |

## Role matrix covered in browser tests

| Role | Covered browser behaviors |
| --- | --- |
| Admin | login, logout, invalid login handling, dashboard access, roles permission changes, users filter/view, projects page |
| Editor | roles page read-only access without write actions |
| Viewer | limited nav visibility, forbidden route state, users page read-only behavior |

## Gaps worth adding next

- backend integration coverage for users/roles/projects routes beyond auth and hardening
- frontend component coverage for users/roles/project tables and dialogs
- backend `RBAC contract` tests mapped per protected route
- E2E flows for audit logs, AI recommendations, and project/archive interactions once those behaviors are fully enabled

## Notes

- Frontend E2E tests currently use mocked `/api/*` responses in Playwright for deterministic browser coverage.
- This keeps the suite fast and stable while still exercising the real React app and routing behavior.
- If you later want a second E2E layer against the live backend/database, add separate specs or a separate Playwright project instead of replacing the current mocked suite.
