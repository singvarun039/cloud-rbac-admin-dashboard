# Day 6: Observability + Audit Logs (Acceptance)

## Pre-reqs

- Backend running (default `http://localhost:3001` if that’s what your `PORT` is).
- DB migrated: `npm run prisma:migrate`
- Seeded users/roles/permissions: `npx prisma db seed`

This repo seeds:

- **Admin**: `admin@naxverse.local` / `Admin@12345`
- **Read-only**: `user@naxverse.local` / `User@12345`

## Notes

- Every response includes `X-Request-Id` (including 404s).
- Logs are JSON (pino) and include: `timestamp`, `level`, `requestId`, `userId` (if authenticated), `message`.
- Audit log writes are best-effort: audit failures never break the request.

## 6 curl commands (prove Day 6)

Set a base URL (PowerShell):

```powershell
$BASE = "http://localhost:3001"
```

1. Login as admin (captures `LOGIN_SUCCESS`) and extract token:

```powershell
$ADMIN_TOKEN = (curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@naxverse.local","password":"Admin@12345"}' | ConvertFrom-Json).data.accessToken
```

2. Login as read-only user (for permission enforcement later):

```powershell
$USER_TOKEN = (curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"user@naxverse.local","password":"User@12345"}' | ConvertFrom-Json).data.accessToken
```

3. Create a user (captures `USER_CREATED`). Use `-i` to show `X-Request-Id`:

```powershell
$NEW_USER = (curl -i -s -X POST "$BASE/api/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"email":"day6.user1@naxverse.local","password":"StrongPass@123","firstName":"Day6","lastName":"User"}' | Select-String -Pattern "\{.*\}" | ForEach-Object { $_.Matches.Value } | ConvertFrom-Json).data.user
```

4. Update that user (captures `USER_UPDATED`):

```powershell
curl -i -s -X PATCH "$BASE/api/users/$($NEW_USER.id)" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"firstName":"Day6Updated"}'
```

5. Role assignment + permission update (captures `ROLE_ASSIGNED` and `ROLE_PERMISSION_UPDATED`):

```powershell
$ADMIN_ROLE_ID = (curl -s -X GET "$BASE/api/roles" -H "Authorization: Bearer $ADMIN_TOKEN" | ConvertFrom-Json).data.roles | Where-Object { $_.name -eq "ADMIN" } | Select-Object -First 1 -ExpandProperty id
curl -i -s -X POST "$BASE/api/roles/assign" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"userId\":\"$($NEW_USER.id)\",\"roleId\":\"$ADMIN_ROLE_ID\"}"; curl -i -s -X PUT "$BASE/api/roles/$ADMIN_ROLE_ID/permissions" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"permissionKeys":["users.read","users.write","roles.read","roles.write","audit.read"]}'
```

6. Fetch audit logs: first as non-admin (expect 403), then as admin (expect 200):

```powershell
curl -i -s -X GET "$BASE/api/audit-logs?page=1&limit=20" -H "Authorization: Bearer $USER_TOKEN"; curl -i -s -X GET "$BASE/api/audit-logs?page=1&limit=20&action=USER_CREATED" -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Quick 404 proof (optional)

```powershell
curl -i -s "$BASE/does-not-exist"
```

You should see `X-Request-Id` even on the 404.
