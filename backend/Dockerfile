# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
WORKDIR /app

COPY package*.json ./
# No lockfile is currently committed in this repo.
# If a lockfile is added later, npm ci will be used automatically.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 4000
CMD ["sh","-c","npm run prisma:generate && npm run dev"]

FROM base AS build
WORKDIR /app

# DATABASE_URL is required by prisma.config.ts during `prisma generate`.
# prisma generate does NOT connect to a database — it only reads schema.prisma
# to emit the Prisma Client types. A syntactically valid placeholder is enough.
# The real DATABASE_URL is never baked into the image; it is injected at
# container runtime via env_file in docker-compose.prod.yml.
ARG DATABASE_URL=postgresql://build-placeholder:x@localhost:5432/build?schema=public
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run prisma:generate \
  && npm run build \
  && npm prune --omit=dev

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

USER node

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/dist ./dist

EXPOSE 4000
CMD ["npm","run","start"]
