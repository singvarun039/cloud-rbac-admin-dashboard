# Frontend (Web)

React (Vite) admin UI for the RBAC API.

## Local development

The preferred dev workflow (Postgres + API + Web) is via Docker Compose from the repo root:

- See `../README.md`

If you want to run the frontend outside Docker, it’s a standard Vite app:

```bash
npm install
npm run dev
```

## Code layout (quick map)

- `src/pages/` — route pages (Dashboard, Users, Roles, Projects, Audit Logs)
- `src/routes/` — app router
- `src/api/` — API client wrappers
- `src/auth/` — auth context + token handling
- `src/components/` — shared UI components

## AWS deploy (Terraform)

See `infra/terraform/README.md` for the Terraform deployment.

### What gets deployed

In the AWS/Terraform deployment, the frontend is served by nginx (not the Vite dev server):

- Builds the production image from `frontend/Dockerfile`
- Serves the compiled SPA (`dist/`) on port 80
- Proxies `/api/*` to the backend container

Browser behavior:

- Use `http://<ec2-public-ip>/` as the single entrypoint.
- Call the API via same-origin paths like `GET /api/health`.

### Troubleshooting (AWS)

On the EC2 instance:

```bash
cd /opt/app
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs --tail=200 nginx
curl -fsS http://127.0.0.1/api/health
```
