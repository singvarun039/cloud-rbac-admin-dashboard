# Day 9: Roles CRUD + Permissions mapping — Notes

## Replace-all semantics (important)

The endpoint `POST /api/roles/:id/permissions` uses **replace-all semantics**:

- The posted list becomes the role's **entire** permission set.
- To **clear** all permissions for a role, send an empty array.
- Exactly one of `permissionKeys` or `permissionIds` must be provided.
- Duplicate entries are rejected with `400 VALIDATION_ERROR`.
- If any permission keys/ids do not exist, the request fails with `400 VALIDATION_ERROR` and a list of invalid keys/ids.

## Endpoints

- `GET /api/roles` (requires `roles.read`)
- `POST /api/roles` (requires `roles.write`)
- `PATCH /api/roles/:id` (requires `roles.write`)
- `POST /api/roles/:id/permissions` (requires `roles.write`)
- `GET /api/permissions` (requires `permissions.read`)

## Examples

Replace permissions by key:

```bash
curl -i -X POST http://localhost:4000/api/roles/<ROLE_ID>/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionKeys":["users.read","users.write"]}'
```

Clear all permissions:

```bash
curl -i -X POST http://localhost:4000/api/roles/<ROLE_ID>/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionKeys":[]}'
```
