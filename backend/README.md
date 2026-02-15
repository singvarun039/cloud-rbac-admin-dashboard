# Backend (API)

Node.js + Express API (Prisma + Postgres). Source of truth for backend code lives here.

## Local development

Preferred dev workflow is Docker Compose from the repo root:

- See `../README.md`

If you want to run the API outside Docker:

```bash
npm install
npm run dev
```

## Common scripts

- `npm run db:init` — initialize local dev DB (migrations + seed)
- `npm run db:deploy` — run Prisma migrations (deploy)
- `npm run db:seed` — run seed
- `npm run migrate` / `npm run seed` — aliases used by the EC2 bootstrap

## AWS deploy (Terraform)

See `infra/terraform/README.md` for the Terraform deployment.

### What gets deployed

Terraform provisions an EC2 instance and (optionally) an RDS Postgres database, then uses EC2 `user_data` to:

- Install Docker + Compose
- Clone this repository into `/opt/app`
- Generate `/opt/app/.env.prod` (contains the backend runtime env vars)
- Run Prisma migrations automatically (and seed once)
- Start the production Docker Compose stack (`docker-compose.prod.yml`)

In production, the API container is not exposed directly to the internet. Instead, the nginx container publishes port 80 and reverse-proxies `/api/*` to the API container internally.

### Database + Prisma (RDS)

- The API connects to RDS using `DATABASE_URL` written into `/opt/app/.env.prod`.
- Migrations run via `prisma migrate deploy`.
- Seeding runs once and drops a marker file at `/opt/app/.seeded` to prevent reseeding on reboot.

Important detail: migrations/seed are executed in a temporary “migrator” container built from the backend Dockerfile `dev` target so the Prisma tooling is available even if the production runtime image prunes devDependencies.

### Runtime environment

Terraform’s `user_data` writes the production env file used by Docker Compose:

- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `DATABASE_URL=postgresql://...&sslmode=require`
- `FRONTEND_ORIGIN` / `CORS_ORIGIN` (origin allowlist)
- `JWT_SECRET` and derived secrets

If you update Terraform variables that affect `/opt/app/.env.prod`, restart the running containers so the new env takes effect.

### Verify + troubleshoot (AWS)

From your laptop (via the nginx reverse proxy):

```bash
curl -i http://<ec2-public-ip>/api/health
```

On the EC2 instance:

```bash
sudo tail -n 200 /var/log/cloud-init-output.log
sudo tail -n 200 /var/log/app-userdata.log

cd /opt/app
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs --tail=200 api
```
