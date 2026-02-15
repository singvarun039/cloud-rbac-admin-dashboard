# AWS — RDS Postgres + EC2 deploy (Docker) via Terraform (Free/Lowest-cost)

This deploy is intentionally minimal (dev/portfolio):

- 1× EC2 `t3.micro` (or `t2.micro`) running Docker + Compose
- 1× RDS Postgres `db.t3.micro` (or free-tier eligible class in your region)
- Public subnets only (no NAT)
- Nginx serves the built React frontend and proxies `/api` to the backend container

Note: RDS requires a DB subnet group spanning at least 2 AZs, so Terraform creates 2 public subnets. The stack is still single-instance and low-cost (EC2 is placed in one subnet; RDS is single-AZ).

## Hard cost constraints (enforced)

This Terraform does **not** create:

- NAT Gateway
- ALB/ELB
- CloudFront
- WAF
- Secrets Manager
- Paid logging/monitoring stacks

## What can cost money

Even on “free tier”, these can cost money depending on your AWS account status/region:

- RDS instance-hours + storage (gp3)
- EC2 instance-hours
- EBS volume on EC2
- Data transfer (usually small for light use)

## Repo changes included

- `docker-compose.prod.yml` (root): `nginx` + `api` only (no Postgres container)
- `frontend/nginx.conf`: serves SPA + proxies `/api` to `api:4000` and adds basic security headers
- `backend/package.json`: adds `npm run migrate` and `npm run seed` aliases used by user_data
- Terraform under `infra/terraform/`

## Prerequisites

- Terraform `>= 1.6`
- AWS credentials configured locally (e.g. `aws configure`)
- An existing EC2 Key Pair in the chosen region
- Your public IP in CIDR form (e.g. `203.0.113.10/32`) for SSH

## Configure variables (local only)

Create a file like `infra/terraform/terraform.tfvars` (do not commit):

WARNING: This file contains secrets (DB password, JWT secret). Never commit it, paste it into issues, or share it.

```hcl
aws_region       = "us-east-1"
project_name     = "cloud-rbac"
allowed_ssh_cidr = "YOUR.IP.ADDR/32"
key_pair_name    = "your-keypair"
github_repo_url  = "https://github.com/singvarun039/cloud-rbac-admin-dashboard.git"

# Optional (default false): temporarily allow Postgres 5432 from allowed_ssh_cidr
allow_db_from_my_ip = false

db_name     = "crbad"
db_username = "postgres"
db_password = "CHANGEME_LONG_PASSWORD"

jwt_secret  = "CHANGEME_LONG_RANDOM_SECRET"

# For first apply, use a placeholder (see Two-step apply for CORS below)
cors_origin = "http://TEMP"

# Cost-safety: turn off to skip RDS (app will not start)
enable_rds = true
```

## Generate strong secrets

- `jwt_secret`:

```bash
openssl rand -base64 32
```

- `db_password` (must be >= 20 chars and include lowercase, uppercase, number, special):

```bash
openssl rand -base64 24
```

Then append 2–4 special characters (e.g. `!@#%`) to satisfy the complexity rule.

## Two-step apply for CORS

Because you won’t know the EC2 public IP until after the first apply:

1) First apply (placeholder): set `cors_origin = "http://TEMP"`, then:

```bash
terraform apply
```

2) Second apply (real origin): replace it with `cors_origin = "http://<ec2_public_ip>"` and apply again.

After the second apply, if you need the backend container to pick up the new allowlist immediately, SSH to the box and restart:

```bash
cd /opt/app
sudo docker compose -f docker-compose.prod.yml restart
```

## Deploy

From `infra/terraform`:

```bash
terraform init
terraform plan
terraform apply
```

Terraform outputs:

- `web_url` → `http://<ec2-ip>/`
- `api_health_url` → `http://<ec2-ip>/api/health`
- `ssh_command`
- `rds_endpoint`

Checklist:

- Open `web_url`
- `curl api_health_url`

## What user_data does on EC2

- Installs Docker + Compose plugin
- Clones the repo to `/opt/app`
- Writes `/opt/app/.env.prod` from Terraform vars:
  - `DATABASE_URL=postgresql://...@<rds-endpoint>:5432/<db>?schema=public&sslmode=require`
  - `FRONTEND_ORIGIN` and `CORS_ORIGIN` (from `cors_origin`, default `auto` → `http://<ec2_public_ip>`)
  - `JWT_SECRET` plus `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REFRESH_TOKEN_HASH_SECRET` (derived from `jwt_secret`)
  - `NODE_ENV=production`, `TRUST_PROXY=true`
- Waits for RDS TCP connectivity on 5432
- Runs migrations on every boot (`prisma migrate deploy`)
- Runs seed **once**, creating `/opt/app/.seeded` so reboots don’t reseed
- Starts production Docker compose (`docker compose -f docker-compose.prod.yml up -d --build`) and waits for `/api/health`

Note: Migrations/seed are executed in a temporary “migrator” container built from the backend Dockerfile `dev` target so Prisma CLI + ts-node are available (the backend `prod` image prunes devDependencies).

## Acceptance tests

A) Web

- Open `http://<ec2-ip>/` → loads React app
- Login using seeded admin credentials printed by seed script defaults:
  - Email: `rbac_admin@rbac.local`
  - Password: `rbac@1234`
- Navigate to pages: Users, Roles, Projects, Audit Logs

B) API

- `curl http://<ec2-ip>/api/health` returns OK JSON (proxied through nginx)

C) Persistence

- Create a user/project, refresh the page → data persists
- Restart containers on EC2:

```bash
cd /opt/app
sudo docker compose -f docker-compose.prod.yml restart
```

Data should persist (stored in RDS).

D) Basic hardening

- Rate limiting: abuse login/refresh endpoints should return `429` (if enabled in API)
- Security headers: `curl -I http://<ec2-ip>/` should include headers like `X-Frame-Options`, `X-Content-Type-Options`
- Error responses include a `X-Request-Id` header (added by backend middleware)

## Cost pitfalls (read this)

- **RDS is the main cost driver.** Do not leave it running when you’re done.
- RDS is deployed into public subnets but is **not publicly accessible by default** (`publicly_accessible=false`). The DB is reachable from the EC2 security group only.
- If you want temporary direct DB access from your IP for debugging, set `publicly_accessible=true` in Terraform and set `allow_db_from_my_ip=true` (this opens 5432 only to your `/32`). Otherwise, prefer the SSH tunnel method.
- If you stop using the stack, destroy it.

## Destroy (important)

From `infra/terraform`:

```bash
terraform destroy
```

This removes EC2 + RDS + VPC resources created by this stack.

## Troubleshooting

- Cloud-init logs:

```bash
sudo tail -n 200 /var/log/cloud-init-output.log
```

- View user_data logs on the instance:

```bash
sudo tail -n 200 /var/log/userdata.log
```

- Check containers:

```bash
cd /opt/app
sudo docker ps
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs --tail=200 nginx
sudo docker compose -f docker-compose.prod.yml logs --tail=200 api
```

- (Optional) Connect to RDS from your laptop via SSH tunnel:

```bash
ssh -i <path-to-private-key.pem> -L 5432:<rds-endpoint>:5432 ubuntu@<ec2-public-ip>
```

Then connect locally to `localhost:5432` using your DB credentials.
