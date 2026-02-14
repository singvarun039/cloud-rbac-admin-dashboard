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

EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","5173"]

FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM nginx:alpine AS prod

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
