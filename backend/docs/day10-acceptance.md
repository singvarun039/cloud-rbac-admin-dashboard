# Day 10: Projects CRUD — Acceptance Checklist

## Setup

Start API:

```bash
npm run dev
```

Login as admin:

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@naxverse.local","password":"Admin@12345"}'
```

Copy the `accessToken` into `TOKEN`:

```bash
export TOKEN="<PASTE_ACCESS_TOKEN>"
```

Login as read-only user:

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@naxverse.local","password":"User@12345"}'
```

Copy the `accessToken` into `RO_TOKEN`:

```bash
export RO_TOKEN="<PASTE_ACCESS_TOKEN>"
```

## Admin: list/create/update/delete succeed

List (empty at first):

```bash
curl -i http://localhost:4000/api/projects?page=1&limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

Create:

```bash
curl -i -X POST http://localhost:4000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project"}'
```

Set `PROJECT_ID` from the response:

```bash
export PROJECT_ID="<PASTE_PROJECT_ID>"
```

Update:

```bash
curl -i -X PATCH http://localhost:4000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project v2"}'
```

Archive (soft delete):

```bash
curl -i -X DELETE http://localhost:4000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"
```

List excludes archived by default:

```bash
curl -i http://localhost:4000/api/projects?page=1&limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

List including archived:

```bash
curl -i "http://localhost:4000/api/projects?page=1&limit=20&includeArchived=true" \
  -H "Authorization: Bearer $TOKEN"
```

## RBAC checks

Read-only user can list:

```bash
curl -i http://localhost:4000/api/projects?page=1&limit=20 \
  -H "Authorization: Bearer $RO_TOKEN"
```

Read-only user cannot mutate (expects 403):

```bash
curl -i -X POST http://localhost:4000/api/projects \
  -H "Authorization: Bearer $RO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nope"}'
```

## Validation failures

Create empty name (expects 400 VALIDATION_ERROR):

```bash
curl -i -X POST http://localhost:4000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}'
```

Patch empty body (expects 400 VALIDATION_ERROR):

```bash
curl -i -X PATCH http://localhost:4000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Not found

Patch random id (expects 404 NOT_FOUND):

```bash
curl -i -X PATCH http://localhost:4000/api/projects/does-not-exist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"x"}'
```

Delete random id (expects 404 NOT_FOUND):

```bash
curl -i -X DELETE http://localhost:4000/api/projects/does-not-exist \
  -H "Authorization: Bearer $TOKEN"
```

## Audit verification

Filter audit logs by action:

```bash
curl -i "http://localhost:4000/api/audit-logs?page=1&limit=50&action=PROJECT_CREATED" \
  -H "Authorization: Bearer $TOKEN"

curl -i "http://localhost:4000/api/audit-logs?page=1&limit=50&action=PROJECT_UPDATED" \
  -H "Authorization: Bearer $TOKEN"

curl -i "http://localhost:4000/api/audit-logs?page=1&limit=50&action=PROJECT_ARCHIVED" \
  -H "Authorization: Bearer $TOKEN"
```
