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
